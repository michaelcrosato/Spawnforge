import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const bin = fileURLToPath(new URL('./bin.ts', import.meta.url));
let client: Client;

const textOf = (result: unknown) =>
  JSON.parse(((result as { content: { text: string }[] }).content[0] as { text: string }).text);

beforeAll(async () => {
  client = new Client({ name: 'spawnforge-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [bin], stderr: 'pipe' }),
  );
}, 20_000);

afterAll(async () => {
  await client?.close();
});

describe('MCP server', () => {
  it('lists its tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'analyze',
      'crossbreed',
      'describe_module',
      'generate',
      'instantiate',
      'list_modules',
      'mutate',
      'patch',
      'render',
      'validate',
    ]);
  });

  it('lists modules by kind', async () => {
    const out = textOf(
      await client.callTool({ name: 'list_modules', arguments: { kind: 'bodyPlan' } }),
    );
    expect(out.modules.map((m: { id: string }) => m.id)).toEqual([
      'biped',
      'hexapod',
      'quadruped',
      'serpent',
    ]);
  });

  it('describes a module', async () => {
    const out = textOf(
      await client.callTool({ name: 'describe_module', arguments: { id: 'horn.curved' } }),
    );
    expect(out.defaults.length).toBe(0.2);
  });

  it('validates a blueprint and explains errors', async () => {
    const out = textOf(
      await client.callTool({
        name: 'validate',
        arguments: { blueprint: { format: 'spawnforge/0.1', extends: 'quadrupd' } },
      }),
    );
    expect(out.ok).toBe(false);
    expect(out.errors[0].fix).toBe('did you mean "quadruped"?');
  });

  it('reports a bad module id as a tool error with a fix', async () => {
    const result = await client.callTool({ name: 'describe_module', arguments: { id: 'hron' } });
    expect(result.isError).toBe(true);
    expect(textOf(result).fix).toBe('did you mean "horn.curved"?');
  });

  it('generates, mutates and crossbreeds valid creatures', async () => {
    const call = async (name: string, args: Record<string, unknown>) =>
      textOf(await client.callTool({ name, arguments: args }));
    const made = await call('generate', {
      theme: 'demon',
      seed: 3,
      constraints: { maxHeight: 1.5, actions: ['roar'] },
    });
    expect(made.ok).toBe(true);
    expect(made.measurements.height).toBeLessThanOrEqual(1.5);
    const child = await call('mutate', { blueprint: made.blueprint, seed: 2, locked: ['skin'] });
    expect(child.ok).toBe(true);
    expect(child.diff.some((line: string) => line.includes(' skin.'))).toBe(false);
    const other = await call('generate', { theme: 'reptile', seed: 1 });
    const cross = await call('crossbreed', { a: made.blueprint, b: other.blueprint, mix: 0.5 });
    expect(cross.ok).toBe(true);
    expect(['a', 'b']).toContain(cross.base);
    const one = await call('instantiate', {
      blueprint: { format: 'spawnforge/0.1', extends: 'quadruped', scale: { min: 0.8, max: 1.2 } },
      seed: 4,
    });
    expect(one.ok).toBe(true);
    expect(one.blueprint.scale).toBeGreaterThanOrEqual(0.8);
  });

  it('serves the blueprint guide as a resource', async () => {
    const res = await client.readResource({ uri: 'spawnforge://docs/blueprint.md' });
    expect((res.contents[0] as { text: string }).text).toMatch(/^# Blueprint format/);
  });
});
