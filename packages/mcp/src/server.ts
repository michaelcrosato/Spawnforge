import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { CommandError, describeModule, listModules, validate } from '@spawnforge/cli';
import { MODULE_KINDS } from '@spawnforge/core';
import type { Renderer } from '@spawnforge/render';
import { z } from 'zod';

const docsDir = new URL('../../../docs/', import.meta.url);

const INSTRUCTIONS = `Spawnforge builds 3D monsters from JSON blueprints.
Workflow: read the blueprint guide (resource spawnforge://docs/blueprint.md) and the catalogue
(spawnforge://docs/catalog.md), start from a body plan ("extends"), then call validate and fix
every error it reports (each has a path, the problem, the valid range and a fix) until ok is true.
Use describe_module for any part, pattern, gait, action or body plan you use.`;

type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function reply(run: () => unknown): ToolResult {
  try {
    const output = run() as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const fix = error instanceof CommandError ? error.fix : undefined;
    const output = { error: error.message, ...(fix ? { fix } : {}) };
    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], isError: true };
  }
}

function readBlueprint(input: { blueprint?: unknown; path?: string }): unknown {
  if (input.blueprint !== undefined) return input.blueprint;
  if (input.path === undefined)
    throw new CommandError('pass either "blueprint" (the JSON object) or "path" (a file)');
  let text: string;
  try {
    text = readFileSync(input.path, 'utf8');
  } catch {
    throw new CommandError(`cannot read ${input.path}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CommandError(`${input.path} is not valid JSON: ${(error as Error).message}`);
  }
}

/** One server instance with every Spawnforge tool and doc resource registered. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'spawnforge', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'list_modules',
    {
      title: 'List modules',
      description:
        'Catalogue of body plans, parts, patterns, gaits and actions: ids, one-line summaries and tags.',
      inputSchema: z.object({
        kind: z.enum(MODULE_KINDS).optional().describe('Only modules of this kind'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ kind }) => reply(() => listModules(kind ? { kind } : {})),
  );

  server.registerTool(
    'describe_module',
    {
      title: 'Describe a module',
      description:
        "One module's parameters (JSON Schema with ranges, defaults and units), how to use it, and an example. For body plans, the preset with the limb and part ids you can override.",
      inputSchema: z.object({
        id: z.string().describe('Module id, e.g. "horn.curved" or "quadruped"'),
        kind: z.enum(MODULE_KINDS).optional().describe('Disambiguates when two kinds share an id'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ id, kind }) => reply(() => describeModule(kind ? { id, kind } : { id })),
  );

  server.registerTool(
    'validate',
    {
      title: 'Validate a blueprint',
      description:
        'Checks a blueprint. Returns ok, errors and warnings (each with an id-based path, the problem, the valid range and a suggested fix), and the minimal blueprint. Pass the blueprint object, or a path to a JSON file.',
      inputSchema: z.object({
        blueprint: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('The blueprint JSON object'),
        path: z
          .string()
          .optional()
          .describe('Path to a blueprint JSON file, instead of "blueprint"'),
        expanded: z.boolean().optional().describe('Also return the fully expanded creature spec'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      reply(() =>
        validate({
          blueprint: readBlueprint(input),
          ...(input.expanded ? { expanded: true } : {}),
        }),
      ),
  );

  for (const [name, file, mimeType, description] of [
    [
      'blueprint-guide',
      'blueprint.md',
      'text/markdown',
      'How to write a blueprint: fields, units, attachment and rules',
    ],
    [
      'catalog',
      'catalog.md',
      'text/markdown',
      'Every module with its parameters, ranges and defaults',
    ],
    [
      'blueprint-schema',
      'blueprint.schema.json',
      'application/schema+json',
      'The blueprint JSON Schema',
    ],
  ] as const) {
    server.registerResource(
      name,
      `spawnforge://docs/${file}`,
      { title: file, description, mimeType },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType, text: readFileSync(new URL(file, docsDir), 'utf8') }],
      }),
    );
  }

  let renderer: Promise<Renderer> | undefined;
  const getRenderer = async () => {
    if (!renderer) {
      const { Renderer } = await import('@spawnforge/render');
      renderer = Renderer.launch();
      renderer.catch(() => {
        renderer = undefined;
      });
    }
    return renderer;
  };
  server.registerTool(
    'render',
    {
      title: 'Render a blueprint',
      description:
        'Renders the creature as a PNG contact sheet: three-quarter, side, head close-up, front, top and rear views with scale bars. With labels, every part and limb is tagged by id, so you can check placement. With filmstrip, it renders one gait cycle as frames plus a footfall diagram and returns the gait, speed, cycle time, stride, duty per leg and foot slide, so you can check how the creature moves. Use it to see whether a blueprint looks and moves like what you meant.',
      inputSchema: z.object({
        blueprint: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('The blueprint JSON object'),
        path: z
          .string()
          .optional()
          .describe('Path to a blueprint JSON file, instead of "blueprint"'),
        labels: z.boolean().optional().describe('Tag every part and limb by id'),
        size: z
          .number()
          .int()
          .min(128)
          .max(1024)
          .optional()
          .describe('Pixels per panel (default 512)'),
        views: z
          .array(z.enum(['three-quarter', 'side', 'head', 'front', 'top', 'rear']))
          .optional()
          .describe('Panels to draw (default all six)'),
        filmstrip: z
          .object({
            gait: z
              .string()
              .optional()
              .describe('Gait id to show, e.g. walk or trot (default: chosen by speed)'),
            speed: z
              .number()
              .min(0.01)
              .max(50)
              .optional()
              .describe('Metres per second (default: typical for the gait)'),
            frames: z.number().int().min(2).max(16).optional().describe('Frames (default 8)'),
            view: z.enum(['side', 'three-quarter', 'top']).optional().describe('Camera'),
          })
          .optional()
          .describe('Render one gait cycle instead of the contact sheet'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      let blueprint: unknown;
      try {
        blueprint = readBlueprint(input);
      } catch (error) {
        return reply(() => {
          throw error;
        });
      }
      const checked = validate({ blueprint });
      if (!checked.ok) return reply(() => ({ ok: false, errors: checked.errors }));
      try {
        const r = await getRenderer();
        const result = await r.render({
          blueprint,
          labels: input.labels ?? false,
          ...(input.size ? { size: input.size } : {}),
          ...(input.views ? { views: input.views } : {}),
          ...(input.filmstrip ? { filmstrip: stripUndefined(input.filmstrip) } : {}),
        });
        return {
          content: [
            { type: 'image' as const, data: result.png.toString('base64'), mimeType: 'image/png' },
            { type: 'text' as const, text: JSON.stringify(result.info, null, 2) },
          ],
        };
      } catch (error) {
        return reply(() => {
          throw new CommandError(`render failed: ${(error as Error).message}`);
        });
      }
    },
  );

  return server;
}

/** Drops undefined fields (the render protocol uses exact optional properties). */
function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
