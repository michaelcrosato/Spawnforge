#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MODULE_KINDS, type ModuleKind } from '@spawnforge/core';
import type { View } from '@spawnforge/render';
import {
  blueprintJsonSchema,
  CommandError,
  describeModule,
  listModules,
  validate,
} from './commands.ts';

const HELP = `Usage: spawnforge <command> [options]

Commands:
  list-modules [--kind <kind>]          Catalogue of parts, patterns, gaits, actions and presets
  describe-module <id> [--kind <kind>]  One module's parameters, ranges, defaults and an example
  validate <file|->  [--expanded]       Errors and warnings with fixes, plus the minimal blueprint
  render <file|-> [--out f.png] [--labels] [--size px] [--views 3/4,side,front,top]
                                        PNG contact sheet of the creature (headless Chromium)
  schema                                The blueprint JSON Schema

Options:
  -h, --help       Show this help

Every command prints JSON to stdout. validate exits 1 when the blueprint has errors.
Kinds: ${MODULE_KINDS.join(', ')}`;

function readInput(path: string): unknown {
  const text = path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CommandError(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

function kindOf(value: string | undefined): ModuleKind | undefined {
  if (value === undefined) return undefined;
  if (!(MODULE_KINDS as readonly string[]).includes(value)) {
    throw new CommandError(`unknown kind "${value}"`, `use one of ${MODULE_KINDS.join(', ')}`);
  }
  return value as ModuleKind;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: 'boolean', short: 'h' },
    kind: { type: 'string' },
    expanded: { type: 'boolean' },
    out: { type: 'string' },
    labels: { type: 'boolean' },
    size: { type: 'string' },
    views: { type: 'string' },
    quality: { type: 'string' },
  },
});
const [command, arg] = positionals;

const VIEW_NAMES: Record<string, View> = {
  '3/4': 'three-quarter',
  'three-quarter': 'three-quarter',
  side: 'side',
  front: 'front',
  top: 'top',
};

async function render(): Promise<{ output: unknown; exitCode?: number }> {
  if (!arg) throw new CommandError('render needs a file path, or - for stdin');
  const blueprint = readInput(arg);
  const checked = validate({ blueprint });
  if (!checked.ok) return { output: { ok: false, errors: checked.errors }, exitCode: 1 };
  const views = values.views?.split(',').map((v) => {
    const view = VIEW_NAMES[v.trim()];
    if (!view) throw new CommandError(`unknown view "${v}"`, 'use 3/4, side, front or top');
    return view;
  });
  const out = values.out ?? (arg === '-' ? 'creature.png' : `${arg.replace(/\.json$/i, '')}.png`);
  const { renderBlueprint } = await import('@spawnforge/render');
  const result = await renderBlueprint({
    blueprint,
    labels: values.labels ?? false,
    ...(values.size ? { size: Number(values.size) } : {}),
    ...(views ? { views } : {}),
    ...(values.quality ? { quality: values.quality as 'low' | 'medium' | 'high' } : {}),
  });
  writeFileSync(out, result.png);
  return {
    output: { ok: true, out, width: result.width, height: result.height, info: result.info },
  };
}

const commands: Record<
  string,
  () => { output: unknown; exitCode?: number } | Promise<{ output: unknown; exitCode?: number }>
> = {
  render,
  'list-modules': () => ({ output: listModules({ kind: kindOf(values.kind) }) }),
  'describe-module': () => {
    if (!arg)
      throw new CommandError(
        'describe-module needs a module id',
        'e.g. spawnforge describe-module horn.curved',
      );
    return { output: describeModule({ id: arg, kind: kindOf(values.kind) }) };
  },
  validate: () => {
    if (!arg) throw new CommandError('validate needs a file path, or - for stdin');
    const result = validate({ blueprint: readInput(arg), expanded: values.expanded });
    return { output: result, exitCode: result.ok ? 0 : 1 };
  },
  schema: () => ({ output: blueprintJsonSchema() }),
};

const run = command === undefined ? undefined : commands[command];
if (values.help || command === undefined) {
  console.log(HELP);
} else if (run === undefined) {
  console.error(`Unknown command "${command}".\n\n${HELP}`);
  process.exitCode = 2;
} else {
  try {
    const { output, exitCode } = await run();
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = exitCode ?? 0;
  } catch (error) {
    if (!(error instanceof CommandError) && !(error instanceof Error && 'code' in error))
      throw error;
    const fix = error instanceof CommandError ? error.fix : undefined;
    console.log(JSON.stringify({ error: error.message, ...(fix ? { fix } : {}) }, null, 2));
    process.exitCode = 2;
  }
}
