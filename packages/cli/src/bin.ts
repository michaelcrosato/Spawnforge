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
  render <file|-> [--out f.png] [--labels] [--size px] [--quality low|medium|high]
         [--views 3/4,side,head,front,top,rear]
                                        PNG contact sheet of the creature (headless Chromium)
  render <file|-> --filmstrip [--gait id] [--speed m/s] [--frames n] [--view side|3/4|top]
                                        One gait cycle as frames with a footfall diagram;
                                        prints cycle, stride, duty and foot slide
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
    filmstrip: { type: 'boolean' },
    gait: { type: 'string' },
    speed: { type: 'string' },
    frames: { type: 'string' },
    view: { type: 'string' },
  },
});
const [command, arg] = positionals;

const VIEW_NAMES: Record<string, View> = {
  '3/4': 'three-quarter',
  'three-quarter': 'three-quarter',
  side: 'side',
  head: 'head',
  front: 'front',
  top: 'top',
  rear: 'rear',
};

function number(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new CommandError(`--${name} must be a number, not "${value}"`);
  return n;
}

async function render(): Promise<{ output: unknown; exitCode?: number }> {
  if (!arg) throw new CommandError('render needs a file path, or - for stdin');
  const blueprint = readInput(arg);
  const checked = validate({ blueprint });
  if (!checked.ok) return { output: { ok: false, errors: checked.errors }, exitCode: 1 };
  const views = values.views?.split(',').map((v) => {
    const view = VIEW_NAMES[v.trim()];
    if (!view)
      throw new CommandError(`unknown view "${v}"`, 'use 3/4, side, head, front, top or rear');
    return view;
  });
  const filmView = values.view === undefined ? undefined : VIEW_NAMES[values.view];
  if (
    values.view !== undefined &&
    filmView !== 'side' &&
    filmView !== 'three-quarter' &&
    filmView !== 'top'
  )
    throw new CommandError(`unknown filmstrip view "${values.view}"`, 'use side, 3/4 or top');
  const speed = number('speed', values.speed);
  const frames = number('frames', values.frames);
  const filmstrip = values.filmstrip
    ? {
        ...(values.gait ? { gait: values.gait } : {}),
        ...(speed !== undefined ? { speed } : {}),
        ...(frames !== undefined ? { frames } : {}),
        ...(filmView ? { view: filmView as 'side' | 'three-quarter' | 'top' } : {}),
      }
    : undefined;
  const suffix = filmstrip ? '.walk.png' : '.png';
  const out =
    values.out ?? (arg === '-' ? `creature${suffix}` : `${arg.replace(/\.json$/i, '')}${suffix}`);
  const { renderBlueprint } = await import('@spawnforge/render');
  const result = await renderBlueprint({
    blueprint,
    labels: values.labels ?? false,
    ...(values.size ? { size: Number(values.size) } : {}),
    ...(views ? { views } : {}),
    ...(values.quality ? { quality: values.quality as 'low' | 'medium' | 'high' } : {}),
    ...(filmstrip ? { filmstrip } : {}),
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
