import { existsSync } from 'node:fs';

/** The docs the server serves as resources (`spawnforge://docs/<file>`). */
export const DOCS = [
  {
    name: 'blueprint-guide',
    file: 'blueprint.md',
    mimeType: 'text/markdown',
    description: 'How to write a blueprint: fields, units, attachment and rules',
  },
  {
    name: 'catalog',
    file: 'catalog.md',
    mimeType: 'text/markdown',
    description: 'Every module with its parameters, ranges and defaults',
  },
  {
    name: 'blueprint-schema',
    file: 'blueprint.schema.json',
    mimeType: 'application/schema+json',
    description: 'The blueprint JSON Schema',
  },
  {
    name: 'scenarios-guide',
    file: 'scenarios.md',
    mimeType: 'text/markdown',
    description: 'Scripted motion for render and analyze: ground, water, targets and timed calls',
  },
  {
    name: 'runtime-guide',
    file: 'runtime.md',
    mimeType: 'text/markdown',
    description: 'Using creatures in a game: the live runtime API, .glb export and stats modules',
  },
  {
    name: 'engines-guide',
    file: 'engines.md',
    mimeType: 'text/markdown',
    description: 'Importing a .glb into Godot, Unity, Unreal and Blender, with extras readers',
  },
] as const;

/**
 * Where the docs are: beside the built server in a published package (`dist/docs`, copied by
 * `pnpm build`), else the repository's `docs/`.
 */
export const docsDir: URL =
  [new URL('./docs/', import.meta.url), new URL('../../../docs/', import.meta.url)].find((dir) =>
    existsSync(new URL('blueprint.md', dir)),
  ) ?? new URL('../../../docs/', import.meta.url);
