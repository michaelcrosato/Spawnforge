/**
 * What the gallery shows (docs/design/12.2-gallery.md): the examples with their contact sheets,
 * every theme at six seeds (written by `pnpm generate`), and the creatures agents wrote for the
 * gate 9 prompt suites, each the last attempt of its prompt.
 */
import promptsA from '../../../eval/prompts.json';
import promptsB from '../../../eval/prompts-b.json';
import themes from './themes.json';

type Json = Record<string, unknown>;

export type Group = 'example' | 'theme' | 'eval';

export interface Entry {
  /** The page's address: `example/grey-wolf`, `theme/dragon-3`, `eval/b01-dragon`. */
  readonly id: string;
  readonly group: Group;
  readonly name: string;
  /** Where it came from, in a line: a file, a `generate` command, or the prompt it answers. */
  readonly note: string;
  /** The blueprint, or a loader for the eval runs' attempts (loaded when opened). */
  readonly blueprint: () => Promise<Json>;
  /** The committed contact sheet, for examples. */
  readonly sheet?: string;
}

const examples = import.meta.glob<Json>('../../../examples/*.json', {
  eager: true,
  import: 'default',
});
const sheets = import.meta.glob<string>('../../../examples/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const attempts = import.meta.glob<Json>(
  [
    '../../../eval/runs/2026-10-07-gate9/*.attempt*.json',
    '../../../eval/runs/2026-10-07-gate9-b/*.attempt*.json',
  ],
  { import: 'default' },
);

const base = (path: string) =>
  path
    .split('/')
    .at(-1)
    ?.replace(/\.(json|png)$/, '') ?? path;
const named = (json: Json, fallback: string) =>
  typeof json.name === 'string' && json.name ? json.name : fallback;

/** The last attempt of each prompt, by its number. */
function lastAttempts(): Map<string, string> {
  const last = new Map<string, { n: number; path: string }>();
  for (const path of Object.keys(attempts)) {
    const match = /\/([^/]+)\.attempt(\d+)\.json$/.exec(path);
    if (!match) continue;
    const [, id, n] = match as unknown as [string, string, string];
    const seen = last.get(id);
    if (!seen || Number(n) > seen.n) last.set(id, { n: Number(n), path });
  }
  return new Map([...last].map(([id, { path }]) => [id, path]));
}

const prompts = new Map(
  [...promptsA, ...promptsB].map((p: { id: string; prompt: string }) => [p.id, p.prompt]),
);

export const entries: readonly Entry[] = [
  ...Object.entries(examples)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, json]): Entry => {
      const file = base(path);
      const sheet = sheets[`../../../examples/${file}.png`];
      return {
        id: `example/${file}`,
        group: 'example',
        name: named(json, file),
        note: `examples/${file}.json`,
        blueprint: async () => json,
        ...(sheet ? { sheet } : {}),
      };
    }),
  ...(themes as { theme: string; seed: number; blueprint: Json }[]).map(
    (t): Entry => ({
      id: `theme/${t.theme}-${t.seed}`,
      group: 'theme',
      name: named(t.blueprint, `${t.theme} ${t.seed}`),
      note: `spawnforge generate --theme ${t.theme} --seed ${t.seed}`,
      blueprint: async () => t.blueprint,
    }),
  ),
  ...[...lastAttempts()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(
      ([id, path]): Entry => ({
        id: `eval/${id}`,
        group: 'eval',
        name: id.replace(/^[pb]\d+-/, '').replace(/-/g, ' '),
        note: `“${prompts.get(id) ?? id}”, written by an agent from the docs (${path.split('/').slice(-2).join('/')})`,
        blueprint: attempts[path] as () => Promise<Json>,
      }),
    ),
];

export const byId = new Map(entries.map((e) => [e.id, e]));
