#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MODULE_KINDS, type ModuleKind } from '@spawnforge/core';
import type { View } from '@spawnforge/render';
import {
  analyze,
  blueprintJsonSchema,
  CommandError,
  describeModule,
  listModules,
  patch,
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
  render <file|-> --filmstrip [--gait id] [--speed m/s] [--frames n] [--view side|3/4|top|front]
                                        One gait cycle as frames with a footfall diagram;
                                        prints cycle, stride, duty and foot slide
  render <file|-> --filmstrip --action <id> [--frames n] [--view side|3/4|top|front]
                                        One action (bite, roar, look…) as frames with its events
  analyze <file|->                      Measurements, mass, speeds, motion checks on flat and
                                        rough ground, plausibility warnings and a description
  patch <file> <ops|ops-file|-> [--dry-run]
                                        Edits a blueprint file by id-based paths and writes it
                                        back if the result is valid; prints the diff. ops is a
                                        JSON list, e.g. '[{"op":"set","path":"body.tail.length","value":1.2}]'
                                        (ops: set, add, remove, mirror, scale)
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
    'dry-run': { type: 'boolean' },
    gait: { type: 'string' },
    action: { type: 'string' },
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
        ...(values.action ? { action: values.action } : {}),
        ...(values.gait ? { gait: values.gait } : {}),
        ...(speed !== undefined ? { speed } : {}),
        ...(frames !== undefined ? { frames } : {}),
        ...(filmView ? { view: filmView as 'side' | 'three-quarter' | 'top' | 'front' } : {}),
      }
    : undefined;
  const suffix = filmstrip ? (values.action ? `.${values.action}.png` : '.walk.png') : '.png';
  const out =
    values.out ?? (arg === '-' ? `creature${suffix}` : `${arg.replace(/\.json$/i, '')}${suffix}`);
  const { renderBlueprint } = await import('@spawnforge/render');
  let result: Awaited<ReturnType<typeof renderBlueprint>>;
  try {
    result = await renderBlueprint({
      blueprint,
      labels: values.labels ?? false,
      ...(values.size ? { size: Number(values.size) } : {}),
      ...(views ? { views } : {}),
      ...(values.quality ? { quality: values.quality as 'low' | 'medium' | 'high' } : {}),
      ...(filmstrip ? { filmstrip } : {}),
    });
  } catch (error) {
    // Errors from the page arrive wrapped ("page.evaluate: Error: …"); keep the message.
    const message = (error as Error).message.replace(/^[\s\S]*?Error: /, '').split('\n')[0];
    throw new CommandError(`render failed: ${message}`);
  }
  writeFileSync(out, result.png);
  return {
    output: { ok: true, out, width: result.width, height: result.height, info: result.info },
  };
}

function patchCommand(): { output: unknown; exitCode?: number } {
  const opsArg = positionals[2];
  if (!arg || !opsArg)
    throw new CommandError(
      'patch needs a blueprint file and operations',
      `e.g. spawnforge patch creature.json '[{"op":"set","path":"body.tail.length","value":1.2}]'`,
    );
  const blueprint = readInput(arg);
  const trimmed = opsArg.trim();
  let ops: unknown;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      ops = JSON.parse(trimmed);
    } catch (error) {
      throw new CommandError(`operations are not valid JSON: ${(error as Error).message}`);
    }
  } else ops = readInput(opsArg);
  const result = patch({ blueprint, ops: Array.isArray(ops) ? ops : [ops] });
  const write = result.ok && !values['dry-run'] && arg !== '-';
  if (write) writeFileSync(arg, `${JSON.stringify(result.blueprint, null, 2)}\n`);
  const { blueprint: patched, ...rest } = result;
  return {
    output: { ...rest, written: write, ...(arg === '-' ? { blueprint: patched } : {}) },
    exitCode: result.ok ? 0 : 1,
  };
}

const commands: Record<
  string,
  () => { output: unknown; exitCode?: number } | Promise<{ output: unknown; exitCode?: number }>
> = {
  render,
  analyze: () => {
    if (!arg) throw new CommandError('analyze needs a file path, or - for stdin');
    const result = analyze({ blueprint: readInput(arg) });
    return { output: result, exitCode: result.ok ? 0 : 1 };
  },
  patch: patchCommand,
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
