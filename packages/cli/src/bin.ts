#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MODULE_KINDS, type ModuleKind } from '@spawnforge/core';
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
  },
});
const [command, arg] = positionals;

const commands: Record<string, () => { output: unknown; exitCode?: number }> = {
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
    const { output, exitCode } = run();
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
