#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { listModules } from './commands.ts';

const HELP = `Usage: spawnforge <command> [options]

Commands:
  list-modules     Catalogue of parts, patterns, gaits, actions and presets

Options:
  -h, --help       Show this help

Every command prints JSON to stdout.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { type: 'boolean', short: 'h' } },
});
const [command] = positionals;

const commands: Record<string, () => unknown> = {
  'list-modules': () => listModules(),
};

const run = command === undefined ? undefined : commands[command];
if (values.help || command === undefined) {
  console.log(HELP);
} else if (run === undefined) {
  console.error(`Unknown command "${command}".\n\n${HELP}`);
  process.exitCode = 2;
} else {
  console.log(JSON.stringify(run(), null, 2));
}
