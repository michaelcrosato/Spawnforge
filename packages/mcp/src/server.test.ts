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
      'describe_module',
      'list_modules',
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

  it('serves the blueprint guide as a resource', async () => {
    const res = await client.readResource({ uri: 'spawnforge://docs/blueprint.md' });
    expect((res.contents[0] as { text: string }).text).toMatch(/^# Blueprint format/);
  });
});
