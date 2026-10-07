#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MODULE_KINDS, type ModuleKind } from '@spawnforge/core';
import type { View } from '@spawnforge/render';
import {
  analyze,
  blueprintJsonSchema,
  CommandError,
  crossbreed,
  describeModule,
  diff,
  exportExtras,
  generate,
  instantiate,
  listModules,
  migrate,
  mutate,
  needIndividual,
  patch,
  prepareScenarioFor,
  validate,
} from './commands.ts';

const HELP = `Usage: spawnforge <command> [options]

Commands:
  list-modules [--kind <kind>]          Catalogue of parts, patterns, gaits, actions and presets
  describe-module <id> [--kind <kind>]  One module's parameters, ranges, defaults and an example
  validate <file|->  [--expanded] [--quiet]
                                        Errors and warnings with fixes, plus the minimal blueprint
                                        (--quiet leaves the blueprint out)
  render <file|-> [--out f.png] [--labels] [--size px] [--quality low|medium|high]
         [--views 3/4,side,head,front,top,rear,underside] [--jaw 0-1] [--blink 0-1]
         [--pose rest|spread]
                                        PNG contact sheet of the creature (headless Chromium);
                                        wings rest folded, --pose spread opens them
  render <file|-> --filmstrip [--gait id] [--speed m/s] [--frames n] [--view side|3/4|top|front]
                                        One gait cycle as frames with a footfall diagram;
                                        prints cycle, stride, duty and foot slide
  render <file|-> --filmstrip --action <id> [--frames n] [--view side|3/4|top|front]
                                        One action (bite, roar, look…) as frames with its events
  render <file|-> --scenario s.json [--view side|3/4|top|front]
                                        A scripted scene (ground, targets, timed calls: moveTo,
                                        follow, act, lookAt…) as frames with its events; prints
                                        what it measured (see docs/scenarios.md)
  analyze <file|-> [--stats id] [--scenario s.json]
                                        Measurements, mass, speeds, motion checks on flat and
                                        rough ground, plausibility warnings and a description;
                                        --stats adds a game's numbers (e.g. rpg); --scenario runs
                                        a scripted scene (targets, a course, timed calls) and
                                        reports its events, distances and foot slide
  migrate <file|-> [--out file] [--dry-run]
                                        Upgrades an older blueprint or species to the current
                                        format and writes it back (or to --out)
  diff <a> <b>                          The patch operations that turn blueprint a into b, by
                                        id-based paths, with one line per change
  patch <file> <ops|ops-file|-> [--dry-run]
                                        Edits a blueprint file by id-based paths and writes it
                                        back if the result is valid; prints the diff. ops is a
                                        JSON list, e.g. '[{"op":"set","path":"body.tail.length","value":1.2}]'
                                        (ops: set, add, remove, mirror, scale)
  generate --theme <id> [--seed n] [--body-plan id] [--max-height m] [--min-height m]
           [--actions bite,roar] [--parts horn.curved] [--out file]
                                        A new creature from a theme (reptile, insect, demon…)
  mutate <file|-> [--seed n] [--amount 0-1] [--lock path,path] [--keep-parts] [--out file]
                                        A child of one blueprint: values drift, parts may change;
                                        locked paths (e.g. skin,body.head) never do
  crossbreed <a> <b> [--seed n] [--mix 0-1] [--base a|b] [--lock path,path] [--out file]
                                        A child of two blueprints; mix is the share from b,
                                        base picks whose body it is built on, locked paths keep
                                        the base parent's values
  export <file|-> [--out f.glb] [--quality low|medium|high] [--clips idle,walk,bite] [--fps n]
         [--stats id]                   A .glb for game engines: skinned mesh with baked vertex
                                        colours, skeleton, baked clips (idle, gaits, actions),
                                        sockets as nodes, the blueprint and stats as extras
  instantiate <species|-> [--seed n] [--out file]
                                        One individual of a species (a blueprint whose numbers
                                        may be { "min": 0.5, "max": 0.7 } ranges)
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

function parseOptions() {
  return parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      kind: { type: 'string' },
      expanded: { type: 'boolean' },
      quiet: { type: 'boolean', short: 'q' },
      out: { type: 'string' },
      labels: { type: 'boolean' },
      jaw: { type: 'string' },
      blink: { type: 'string' },
      pose: { type: 'string' },
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
      theme: { type: 'string' },
      seed: { type: 'string' },
      'body-plan': { type: 'string' },
      'max-height': { type: 'string' },
      'min-height': { type: 'string' },
      actions: { type: 'string' },
      parts: { type: 'string' },
      amount: { type: 'string' },
      lock: { type: 'string' },
      'keep-parts': { type: 'boolean' },
      mix: { type: 'string' },
      base: { type: 'string' },
      stats: { type: 'string' },
      scenario: { type: 'string' },
      clips: { type: 'string' },
      fps: { type: 'string' },
    },
  });
}
let parsed: ReturnType<typeof parseOptions>;
try {
  parsed = parseOptions();
} catch (error) {
  // A missing value or an unknown flag: say so as JSON, like every other error.
  console.log(
    JSON.stringify({ error: (error as Error).message, fix: 'see spawnforge --help' }, null, 2),
  );
  process.exit(2);
}
const { positionals, values } = parsed;
const [command, arg] = positionals;

const VIEW_NAMES: Record<string, View> = {
  '3/4': 'three-quarter',
  'three-quarter': 'three-quarter',
  side: 'side',
  head: 'head',
  front: 'front',
  top: 'top',
  rear: 'rear',
  underside: 'underside',
};

/** --quality: low, medium or high. */
/** `--pose`: the rest pose (wings folded) or spread. */
function poseSpread(value: string | undefined): number {
  if (value === undefined || value === 'rest') return 0;
  if (value === 'spread') return 1;
  throw new CommandError(`unknown pose "${value}": use rest or spread`);
}

function qualityOf(value: string | undefined): 'low' | 'medium' | 'high' | undefined {
  if (value === undefined) return undefined;
  if (value !== 'low' && value !== 'medium' && value !== 'high')
    throw new CommandError(`unknown quality "${value}"`, 'use low, medium or high');
  return value;
}

function number(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new CommandError(`--${name} must be a number, not "${value}"`);
  return n;
}

async function render(): Promise<{ output: unknown; exitCode?: number }> {
  if (!arg) throw new CommandError('render needs a file path, or - for stdin');
  const blueprint = readInput(arg);
  needIndividual(blueprint, 'render');
  const checked = validate({ blueprint });
  if (!checked.ok) return { output: { ok: false, errors: checked.errors }, exitCode: 1 };
  const views = values.views?.split(',').map((v) => {
    const view = VIEW_NAMES[v.trim()];
    if (!view)
      throw new CommandError(
        `unknown view "${v}"`,
        'use 3/4, side, head, front, top, rear or underside',
      );
    return view;
  });
  const filmView = values.view === undefined ? undefined : VIEW_NAMES[values.view];
  if (
    values.view !== undefined &&
    filmView !== 'side' &&
    filmView !== 'three-quarter' &&
    filmView !== 'top' &&
    filmView !== 'front'
  )
    throw new CommandError(
      `unknown filmstrip view "${values.view}"`,
      'use side, 3/4, top or front',
    );
  const speed = number('speed', values.speed);
  const frames = number('frames', values.frames);
  // A scenario is a filmstrip of its own; check it first, so mistakes come back with fixes.
  const scenario = values.scenario === undefined ? undefined : readInput(values.scenario);
  if (scenario !== undefined) {
    const prepared = prepareScenarioFor(blueprint, scenario);
    if (!prepared.ok) return { output: { ok: false, errors: prepared.errors }, exitCode: 1 };
  }
  const filmstrip =
    values.filmstrip || scenario !== undefined
      ? {
          ...(scenario !== undefined ? { scenario } : {}),
          ...(values.action ? { action: values.action } : {}),
          ...(values.gait ? { gait: values.gait } : {}),
          ...(speed !== undefined ? { speed } : {}),
          ...(frames !== undefined ? { frames } : {}),
          ...(filmView ? { view: filmView as 'side' | 'three-quarter' | 'top' | 'front' } : {}),
        }
      : undefined;
  const scenarioName = values.scenario
    ?.split(/[\\/]/)
    .at(-1)
    ?.replace(/\.json$/i, '');
  const suffix = scenarioName
    ? `.${scenarioName}.png`
    : filmstrip
      ? values.action
        ? `.${values.action}.png`
        : '.walk.png'
      : '.png';
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
      ...(values.quality ? { quality: qualityOf(values.quality) } : {}),
      ...(filmstrip ? { filmstrip } : {}),
      ...(values.jaw || values.blink || values.pose
        ? {
            pose: {
              jaw: Number(values.jaw ?? 0),
              blink: Number(values.blink ?? 0),
              spread: poseSpread(values.pose),
            },
          }
        : {}),
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

const list = (value: string | undefined) =>
  value === undefined
    ? undefined
    : value
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x !== '');

const seedOf = () => {
  const seed = number('seed', values.seed);
  if (seed !== undefined && !Number.isInteger(seed))
    throw new CommandError(`--seed must be an integer, not "${values.seed}"`);
  return seed;
};

/** Writes the blueprint to --out when the result is ok; otherwise prints it with the result. */
function emit(result: { ok: boolean; blueprint: Record<string, unknown> }): {
  output: unknown;
  exitCode: number;
} {
  const exitCode = result.ok ? 0 : 1;
  if (values.out && result.ok) {
    writeFileSync(values.out, `${JSON.stringify(result.blueprint, null, 2)}\n`);
    const { blueprint: _written, ...rest } = result;
    return { output: { ...rest, written: values.out }, exitCode };
  }
  return { output: result, exitCode };
}

const commands: Record<
  string,
  () => { output: unknown; exitCode?: number } | Promise<{ output: unknown; exitCode?: number }>
> = {
  render,
  analyze: () => {
    if (!arg) throw new CommandError('analyze needs a file path, or - for stdin');
    const result = analyze({
      blueprint: readInput(arg),
      ...(values.stats ? { stats: values.stats } : {}),
      ...(values.scenario ? { scenario: readInput(values.scenario) } : {}),
    });
    return { output: result, exitCode: result.ok ? 0 : 1 };
  },
  patch: patchCommand,
  generate: () => {
    if (!values.theme)
      throw new CommandError(
        'generate needs --theme',
        'e.g. spawnforge generate --theme reptile --seed 3',
      );
    const seed = seedOf();
    const maxHeight = number('max-height', values['max-height']);
    const minHeight = number('min-height', values['min-height']);
    const actions = list(values.actions);
    const parts = list(values.parts);
    return emit(
      generate({
        theme: values.theme,
        ...(seed !== undefined ? { seed } : {}),
        constraints: {
          ...(values['body-plan'] ? { bodyPlan: values['body-plan'] } : {}),
          ...(maxHeight !== undefined ? { maxHeight } : {}),
          ...(minHeight !== undefined ? { minHeight } : {}),
          ...(actions ? { actions } : {}),
          ...(parts ? { parts } : {}),
        },
      }),
    );
  },
  mutate: () => {
    if (!arg) throw new CommandError('mutate needs a blueprint file, or - for stdin');
    const seed = seedOf();
    const amount = number('amount', values.amount);
    const locked = list(values.lock);
    return emit(
      mutate({
        blueprint: readInput(arg),
        ...(seed !== undefined ? { seed } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(locked ? { locked } : {}),
        ...(values['keep-parts'] ? { structure: false } : {}),
      }),
    );
  },
  migrate: () => {
    if (!arg) throw new CommandError('migrate needs a file path, or - for stdin');
    const result = migrate({ blueprint: readInput(arg) });
    const target = values.out ?? (arg === '-' ? undefined : arg);
    const write =
      result.ok &&
      !values['dry-run'] &&
      target !== undefined &&
      (result.changed || values.out !== undefined);
    if (write) writeFileSync(target as string, `${JSON.stringify(result.blueprint, null, 2)}\n`);
    const { blueprint, ...rest } = result;
    return {
      output: {
        ...rest,
        written: write ? target : false,
        ...(target === undefined ? { blueprint } : {}),
      },
      exitCode: result.ok ? 0 : 1,
    };
  },
  diff: () => {
    const other = positionals[2];
    if (!arg || !other)
      throw new CommandError(
        'diff needs two blueprint files',
        'e.g. spawnforge diff a.json b.json',
      );
    const result = diff({ a: readInput(arg), b: readInput(other) });
    return { output: result, exitCode: result.ok ? 0 : 1 };
  },
  crossbreed: () => {
    const other = positionals[2];
    if (!arg || !other)
      throw new CommandError(
        'crossbreed needs two blueprint files',
        'e.g. spawnforge crossbreed a.json b.json --mix 0.5',
      );
    const seed = seedOf();
    const mix = number('mix', values.mix);
    const locked = list(values.lock);
    if (values.base !== undefined && values.base !== 'a' && values.base !== 'b')
      throw new CommandError(`--base must be a or b, not "${values.base}"`);
    return emit(
      crossbreed({
        a: readInput(arg),
        b: readInput(other),
        ...(seed !== undefined ? { seed } : {}),
        ...(mix !== undefined ? { mix } : {}),
        ...(values.base ? { base: values.base as 'a' | 'b' } : {}),
        ...(locked ? { locked } : {}),
      }),
    );
  },
  export: async () => {
    if (!arg) throw new CommandError('export needs a blueprint file, or - for stdin');
    const blueprint = readInput(arg);
    const extras = exportExtras({ blueprint, ...(values.stats ? { stats: values.stats } : {}) });
    const clips = list(values.clips);
    const fps = number('fps', values.fps);
    if (fps !== undefined && !(Number.isInteger(fps) && fps >= 5 && fps <= 120))
      throw new CommandError(`--fps must be a whole number from 5 to 120, not ${fps}`);
    const quality = qualityOf(values.quality);
    const out = values.out ?? (arg === '-' ? 'creature.glb' : `${arg.replace(/\.json$/i, '')}.glb`);
    const { exportBlueprint } = await import('@spawnforge/render');
    let result: Awaited<ReturnType<typeof exportBlueprint>>;
    try {
      result = await exportBlueprint({
        blueprint,
        extras,
        ...(quality ? { quality } : {}),
        ...(clips ? { clips } : {}),
        ...(fps !== undefined ? { fps } : {}),
      });
    } catch (error) {
      const message = (error as Error).message.replace(/^[\s\S]*?Error: /, '').split('\n')[0];
      throw new CommandError(`export failed: ${message}`);
    }
    writeFileSync(out, result.glb);
    return {
      output: { ok: true, out, ...result.info, ...(extras.stats ? { stats: extras.stats } : {}) },
    };
  },
  instantiate: () => {
    if (!arg) throw new CommandError('instantiate needs a species file, or - for stdin');
    const seed = seedOf();
    return emit(instantiate({ species: readInput(arg), ...(seed !== undefined ? { seed } : {}) }));
  },
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
    // --quiet: the verdict only, without the minimal (or expanded) blueprint.
    const output = values.quiet
      ? Object.fromEntries(
          Object.entries(result).filter(([key]) => key !== 'blueprint' && key !== 'expanded'),
        )
      : result;
    return { output, exitCode: result.ok ? 0 : 1 };
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
