import { readFileSync, writeFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import {
  analysisView,
  analyze,
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
  patchOpsSchema,
  prepareScenarioFor,
  validate,
} from '@spawnforge/cli';
import { MODULE_KINDS } from '@spawnforge/core';
import type { Renderer } from '@spawnforge/render';
import { z } from 'zod';
import { DOCS, docsDir } from './docs.ts';

const SCENARIO_HELP =
  'A scenario: { "ground": "flat" | "course", "duration": seconds, "start": { "x", "z", "heading" }, "targets": { "prey": [x, y, z] }, "calls": [{ "at": 0, "do": "moveTo", "to": [x, z] | "prey" }, { "at": 0, "do": "follow", "path": [[x, z], …] }, { "at": 2, "do": "act", "action": "bite", "target": "prey" }, { "at": 1, "do": "lookAt", "target": … }, { "at": 3, "do": "stop" }, { "at": 0, "do": "drive", "speed": 1, "heading": 90 }, { "at": 0, "do": "gait", "gait": "trot" }], "frames": 8 }. Metres and seconds; heading 0 faces +Z. Returns its events, the distance walked, how close a head came to each target, courses reached and foot slide.';

const INSTRUCTIONS = `Spawnforge builds 3D monsters from JSON blueprints.
Workflow: read the blueprint guide (resource spawnforge://docs/blueprint.md) and the catalogue
(spawnforge://docs/catalog.md), start from a body plan ("extends"), then call validate and fix
every error it reports (each has a path, the problem, the valid range and a fix) until ok is true.
Use describe_module for any part, pattern, gait, action or body plan you use. To start from
something rather than nothing, generate makes a creature from a theme; mutate and crossbreed make
children of existing blueprints. export writes a .glb with baked clips for a game engine
(spawnforge://docs/runtime.md explains what it holds).`;

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
    { name: 'spawnforge', version: '0.2.0' },
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

  server.registerTool(
    'analyze',
    {
      title: 'Analyze a blueprint',
      description:
        'Builds the creature and checks it: measurements (length, height, bodyHeight, width, mass, centre of mass, hip height, and counts of heads, tails and limbs by role), speeds per gait, bite reach, balance over its feet, and motion run for two gait cycles on flat and rough ground (foot slide, ground penetration, legs stretched past their reach, limbs passing through each other or the body, each with the limb and time). Returns plausibility warnings with id-based paths and fixes, and a plain-text description of the creature. With a scenario it also runs that scripted scene and reports its events, distance walked, how close a snout came to each target, courses reached and foot slide. Use it after validate and before render to catch problems you cannot see in a still image.',
      inputSchema: z.object({
        blueprint: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('The blueprint JSON object'),
        path: z
          .string()
          .optional()
          .describe('Path to a blueprint JSON file, instead of "blueprint"'),
        stats: z
          .string()
          .optional()
          .describe('A stats module id (list_modules kind "stats"), to add that game\'s numbers'),
        scenario: z.record(z.string(), z.unknown()).optional().describe(SCENARIO_HELP),
        summary: z
          .boolean()
          .optional()
          .describe('Only the warnings, description, main sizes, speeds and reach'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      reply(() =>
        analysisView(
          analyze({
            blueprint: readBlueprint(input),
            ...(input.stats ? { stats: input.stats } : {}),
            ...(input.scenario ? { scenario: input.scenario } : {}),
          }),
          input.summary === true,
        ),
      ),
  );

  server.registerTool(
    'patch',
    {
      title: 'Edit a blueprint',
      description:
        'Applies edit operations to a blueprint by id-based paths and validates the result: set (a value), add (an item to a list such as parts or skin.layers), remove (a key, back to the default, or a limb/part; inherited ones get "remove": true), mirror (make a limb or part a pair with side "both", or set a side) and scale (multiply a number or profile by "by"; path "" scales the whole creature). Paths look like error paths: "limbs[id=hindleg].length", "parts[id=horns].params.curve", "skin.layers[type=mottle].strength" (layers, gaits and actions by type) or "skin.layers[0].size". With "path", the file is rewritten only when the result is valid (or "out" is written, leaving it as it was). Returns the diff, errors and warnings.',
      inputSchema: z.object({
        blueprint: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('The blueprint JSON object (the patched one is returned)'),
        path: z
          .string()
          .optional()
          .describe('Path to a blueprint JSON file to edit in place, instead of "blueprint"'),
        ops: patchOpsSchema,
        out: z
          .string()
          .optional()
          .describe('Write the result to this file instead (the input file is left as it was)'),
        dryRun: z.boolean().optional().describe('Check and diff without writing the file'),
      }),
    },
    async (input) =>
      reply(() => {
        const result = patch({ blueprint: readBlueprint(input), ops: input.ops });
        const target = input.out ?? input.path;
        const write = result.ok && target !== undefined && !input.dryRun;
        if (write)
          writeFileSync(target as string, `${JSON.stringify(result.blueprint, null, 2)}\n`);
        const { blueprint, ...rest } = result;
        return { ...rest, written: write, ...(target === undefined ? { blueprint } : {}) };
      }),
  );

  server.registerTool(
    'migrate',
    {
      title: 'Upgrade a blueprint to the current format',
      description:
        'Upgrades a blueprint or species written in an older format to the current one, step by step (each step is listed), and validates the result. With "path", the file is rewritten when anything changed (unless dryRun). validate and every other tool read older formats anyway; migrate is for keeping saved files current.',
      inputSchema: z.object({
        blueprint: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('The blueprint JSON object (the upgraded one is returned)'),
        path: z
          .string()
          .optional()
          .describe('Path to a blueprint JSON file to upgrade in place, instead of "blueprint"'),
        dryRun: z.boolean().optional().describe('Report without writing the file'),
      }),
    },
    async (input) =>
      reply(() => {
        const result = migrate({ blueprint: readBlueprint(input) });
        const write = result.ok && result.changed && input.path !== undefined && !input.dryRun;
        if (write)
          writeFileSync(input.path as string, `${JSON.stringify(result.blueprint, null, 2)}\n`);
        const { blueprint, ...rest } = result;
        return { ...rest, written: write, ...(input.path === undefined ? { blueprint } : {}) };
      }),
  );

  server.registerTool(
    'diff',
    {
      title: 'Diff two blueprints',
      description:
        'Compares two blueprints by the creatures they resolve to (presets merged, defaults filled) and returns the patch operations that turn a into b, by id-based paths, ready for the patch tool, plus one line per change ("~ path: from → to", "+ path: value", "- path"). "exact" says whether patching a with them gives exactly b\'s creature.',
      inputSchema: z.object({
        a: z.record(z.string(), z.unknown()).optional().describe('Blueprint a, as a JSON object'),
        b: z.record(z.string(), z.unknown()).optional().describe('Blueprint b, as a JSON object'),
        aPath: z.string().optional().describe('Path to blueprint a, instead of "a"'),
        bPath: z.string().optional().describe('Path to blueprint b, instead of "b"'),
      }),
    },
    async (input) =>
      reply(() =>
        diff({
          a: readBlueprint({ blueprint: input.a, path: input.aPath }),
          b: readBlueprint({ blueprint: input.b, path: input.bPath }),
        }),
      ),
  );

  const blueprintInput = (what: string) => ({
    blueprint: z.record(z.string(), z.unknown()).optional().describe(`The ${what} JSON object`),
    path: z.string().optional().describe(`Path to the ${what} JSON file, instead of "blueprint"`),
  });
  const outInput = z
    .string()
    .optional()
    .describe('File to write the new blueprint to (only when ok); otherwise it is returned');
  const emit = (result: { ok: boolean; blueprint: Record<string, unknown> }, out?: string) => {
    if (out === undefined || !result.ok) return result;
    writeFileSync(out, `${JSON.stringify(result.blueprint, null, 2)}\n`);
    const { blueprint: _written, ...rest } = result;
    return { ...rest, written: out };
  };

  server.registerTool(
    'generate',
    {
      title: 'Generate a creature from a theme',
      description:
        'Builds a new, valid creature from a theme (list_modules with kind "theme": reptile, insect, demon, dragon, aquatic, eldritch, beast) and a seed: the theme weights the body plan, proportions, limbs, parts, patterns, colours and temperament. Constraints fix the body plan, a body height range in metres (the creature is rescaled to fit), actions it must be able to do, part types it must have and media it must move in (air needs a theme with wings). The same theme, seed and constraints always give the same creature. Returns the minimal blueprint and its body height (bodyHeight, without horns, as analyze reports it) and length.',
      inputSchema: z.object({
        theme: z.string().describe('Theme module id, e.g. "reptile"'),
        seed: z.number().int().optional().describe('Which creature (default 1)'),
        constraints: z
          .object({
            bodyPlan: z.string().optional().describe('Body plan id to use, e.g. "biped"'),
            maxHeight: z.number().positive().optional().describe('Largest body height in metres'),
            minHeight: z.number().positive().optional().describe('Smallest body height in metres'),
            actions: z.array(z.string()).optional().describe('Actions it must have, e.g. ["bite"]'),
            parts: z
              .array(z.string())
              .optional()
              .describe('Part types it must have, e.g. ["horn.curved"]'),
            requires: z
              .array(z.enum(['land', 'water', 'air']))
              .optional()
              .describe('Media it must move in, e.g. ["air"] for a flyer, ["water"] for a swimmer'),
          })
          .optional(),
        out: outInput,
      }),
    },
    async (input) =>
      reply(() =>
        emit(
          generate({
            theme: input.theme,
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
            ...(input.constraints ? { constraints: input.constraints } : {}),
          }),
          input.out,
        ),
      ),
  );

  server.registerTool(
    'mutate',
    {
      title: 'Mutate a blueprint',
      description:
        'Makes a child of one blueprint: numbers drift within their ranges, colours shift, and now and then an enum flips or a part is added, removed or swapped for one with matching tags (eyes and ears are kept). "amount" (0 to 1, default 0.3) sets how many genes change and how far. "locked" lists id-based paths that never change, e.g. ["skin", "body.head", "parts[id=horns]"]. The same parent and seed always give the same child. Returns the new blueprint and a gene-by-gene diff against the parent.',
      inputSchema: z.object({
        ...blueprintInput('parent blueprint'),
        seed: z.number().int().optional().describe('Which mutation (default 1)'),
        amount: z.number().min(0).max(1).optional().describe('How far to drift, 0 to 1'),
        locked: z.array(z.string()).optional().describe('Paths that never change'),
        structure: z
          .boolean()
          .optional()
          .describe('Whether parts may be added, removed or swapped (default true)'),
        out: outInput,
      }),
    },
    async (input) =>
      reply(() =>
        emit(
          mutate({
            blueprint: readBlueprint(input),
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            ...(input.locked ? { locked: input.locked } : {}),
            ...(input.structure !== undefined ? { structure: input.structure } : {}),
          }),
          input.out,
        ),
      ),
  );

  server.registerTool(
    'crossbreed',
    {
      title: 'Crossbreed two blueprints',
      description:
        'Makes a child of two blueprints. It keeps one parent\'s body plan (the second\'s with chance "mix" when they differ), matches limbs by id or role, parts by id or type and layers by type, blends numbers and colours between matched genes, picks enums from either parent, and inherits unmatched parts, layers and actions by chance. "mix" (0 to 1, default 0.5) is the share from b; 0 or 1 copies a parent. Returns the new blueprint, which parent it is built on ("base") and a diff against that parent.',
      inputSchema: z.object({
        a: z.record(z.string(), z.unknown()).optional().describe('Parent a, as a JSON object'),
        b: z.record(z.string(), z.unknown()).optional().describe('Parent b, as a JSON object'),
        aPath: z.string().optional().describe('Path to parent a, instead of "a"'),
        bPath: z.string().optional().describe('Path to parent b, instead of "b"'),
        seed: z.number().int().optional().describe('Which child (default 1)'),
        mix: z.number().min(0).max(1).optional().describe('Share from b, 0 to 1'),
        base: z
          .enum(['a', 'b'])
          .optional()
          .describe('The parent whose body plan and file the child is built on'),
        locked: z
          .array(z.string())
          .optional()
          .describe('Paths that keep the base parent\'s values, e.g. ["body.torso", "limbs"]'),
        out: outInput,
      }),
    },
    async (input) =>
      reply(() =>
        emit(
          crossbreed({
            a: readBlueprint({ blueprint: input.a, path: input.aPath }),
            b: readBlueprint({ blueprint: input.b, path: input.bPath }),
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
            ...(input.mix !== undefined ? { mix: input.mix } : {}),
            ...(input.base ? { base: input.base } : {}),
            ...(input.locked ? { locked: input.locked } : {}),
          }),
          input.out,
        ),
      ),
  );

  server.registerTool(
    'instantiate',
    {
      title: 'Make an individual of a species',
      description:
        'A species is a blueprint in which any number can be a range, { "min": 0.5, "max": 0.7 }. This resolves every range for a seed (each range from its own stream, so one range never reshuffles another) and validates the individual. validate checks a species at both ends of every range.',
      inputSchema: z.object({
        ...blueprintInput('species'),
        seed: z.number().int().optional().describe('Which individual (default 1)'),
        out: outInput,
      }),
    },
    async (input) =>
      reply(() =>
        emit(
          instantiate({
            species: readBlueprint(input),
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
          }),
          input.out,
        ),
      ),
  );

  for (const { name, file, mimeType, description } of DOCS) {
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
        'Renders the creature as a PNG contact sheet: three-quarter, side, head close-up, front, top and rear views with scale bars (add an underside view through views). With labels, every part and limb is tagged by id, so you can check placement. With filmstrip, it renders one gait cycle as frames plus a footfall diagram and returns the gait, speed, cycle time, stride, duty per leg and foot slide, so you can check how the creature moves; with filmstrip.action it shows one action (bite, roar, look) and the events it fires; with filmstrip.scenario it plays a scripted scene (targets, a course, timed calls) and returns what it measured. Use it to see whether a blueprint looks and moves like what you meant.',
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
          .array(z.enum(['three-quarter', 'side', 'head', 'front', 'top', 'rear', 'underside']))
          .optional()
          .describe(
            'Panels to draw (default the six views); "underside" looks up at the belly and feet',
          ),
        filmstrip: z
          .object({
            action: z
              .string()
              .optional()
              .describe('An action id (bite, roar, look…) to show instead of a gait cycle'),
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
            view: z
              .enum(['side', 'three-quarter', 'top', 'front'])
              .optional()
              .describe(
                'Camera (default side; top for legless bodies; 3/4 on the head for actions)',
              ),
            scenario: z
              .record(z.string(), z.unknown())
              .optional()
              .describe(`Draw a scenario instead of a gait cycle: ${SCENARIO_HELP}`),
          })
          .optional()
          .describe('Render one gait cycle instead of the contact sheet'),
        pose: z
          .object({
            jaw: z.number().min(0).max(1).optional().describe('Open the jaw, 0 shut to 1 wide'),
            blink: z.number().min(0).max(1).optional().describe('Shut the eyes, 0 open to 1 shut'),
            spread: z
              .number()
              .min(0)
              .max(1)
              .optional()
              .describe('Spread the wings, 0 folded (as they rest) to 1 spread'),
            flare: z
              .number()
              .min(0)
              .max(1)
              .optional()
              .describe('Open frills and hoods and raise quills and sails, 0 at rest to 1'),
          })
          .optional()
          .describe('Pose the still: jaw, eyes, wings (they rest folded) and display parts'),
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
      if (checked.species)
        return reply(() => {
          needIndividual(blueprint, 'render');
        });
      if (!checked.ok) return reply(() => ({ ok: false, errors: checked.errors }));
      if (input.filmstrip?.scenario) {
        const prepared = prepareScenarioFor(blueprint, input.filmstrip.scenario);
        if (!prepared.ok) return reply(() => ({ ok: false, errors: prepared.errors }));
      }
      try {
        const r = await getRenderer();
        const result = await r.render({
          blueprint,
          labels: input.labels ?? false,
          ...(input.size ? { size: input.size } : {}),
          ...(input.views ? { views: input.views } : {}),
          ...(input.filmstrip ? { filmstrip: stripUndefined(input.filmstrip) } : {}),
          ...(input.pose ? { pose: stripUndefined(input.pose) } : {}),
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

  server.registerTool(
    'export',
    {
      title: 'Export a .glb',
      description:
        'Writes the creature as binary glTF (.glb) for game engines: one skinned mesh each for skin, hard parts, eyes and membranes, each with texture maps baked from the live material (albedo, a normal map for the relief, occlusion and roughness, glow), or vertex colours with textures "none"; levels of detail (skin_LOD1 to 3, parts_LOD1 to 3); the skeleton; baked animation clips (idle, one in-place cycle of each gait, each action); gameplay sockets (head, mouth, eyes, claw tips, centre of mass) as nodes; and the minimal blueprint, clip timings, events, hit capsules and optional stats as extras. Metres, Y up, facing +Z.',
      inputSchema: z.object({
        blueprint: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('The blueprint JSON object'),
        path: z
          .string()
          .optional()
          .describe('Path to a blueprint JSON file, instead of "blueprint"'),
        out: z.string().describe('Where to write the .glb'),
        quality: z
          .enum(['low', 'medium', 'high'])
          .optional()
          .describe('Mesh detail (default medium)'),
        clips: z
          .array(z.string())
          .optional()
          .describe('Clips to bake: "idle", gait ids, action ids (default all)'),
        fps: z.number().int().min(5).max(120).optional().describe('Frames per second (default 30)'),
        stats: z.string().optional().describe("A stats module id, to store that game's numbers"),
        textures: z
          .union([z.literal(512), z.literal(1024), z.literal(2048), z.literal('none')])
          .optional()
          .describe(
            'The skin map size in texels (the other maps follow), or "none" for vertex colours; default by quality',
          ),
        lods: z
          .boolean()
          .optional()
          .describe(
            'Levels of detail for skin and parts, as skin_LOD1 to 3 (50, 25 and 10% of the triangles) with MSFT_lod (default true)',
          ),
      }),
    },
    async (input) => {
      let blueprint: unknown;
      let extras: Record<string, unknown>;
      try {
        blueprint = readBlueprint(input);
        extras = exportExtras({ blueprint, ...(input.stats ? { stats: input.stats } : {}) });
      } catch (error) {
        return reply(() => {
          throw error;
        });
      }
      try {
        const r = await getRenderer();
        const result = await r.export({
          blueprint,
          extras,
          ...(input.quality ? { quality: input.quality } : {}),
          ...(input.clips ? { clips: input.clips } : {}),
          ...(input.fps ? { fps: input.fps } : {}),
          ...(input.textures !== undefined ? { textures: input.textures } : {}),
          ...(input.lods !== undefined ? { lods: input.lods } : {}),
        });
        writeFileSync(input.out, result.glb);
        return reply(() => ({
          ok: true,
          out: input.out,
          ...result.info,
          ...(extras.stats ? { stats: extras.stats } : {}),
        }));
      } catch (error) {
        return reply(() => {
          throw new CommandError(`export failed: ${(error as Error).message}`);
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
