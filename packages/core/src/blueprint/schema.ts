import { z } from 'zod';
import { FORMAT } from '../format.ts';
import { isColor } from './colors.ts';

/**
 * The blueprint schema. Everything has a default except item ids and part types, so short
 * blueprints are valid. Module-specific fields (part `params`, foot and layer fields) are checked
 * against each module's own schema in a second pass; see validate.ts.
 */

export const SECTIONS = ['torso', 'neck', 'head', 'tail'] as const;
/** `spine` runs from the head end of the neck (0) through the torso to the tail tip (1). */
export const VIRTUAL_SECTIONS = ['spine'] as const;
export type Section = (typeof SECTIONS)[number];
export const SIDES = ['both', 'left', 'right', 'center'] as const;
export type Side = (typeof SIDES)[number];
export const HEAD_SHAPES = ['round', 'snout', 'flat', 'wedge'] as const;
export const CROSS_SECTIONS = ['round', 'tall', 'wide'] as const;
export const TEMPERAMENTS = ['calm', 'stalking', 'skittish', 'aggressive', 'lumbering'] as const;
export const REGIONS = ['all', 'back', 'belly', 'head', 'torso', 'limbs', 'tail'] as const;
export const SKIN_MATERIALS = ['skin', 'scales', 'chitin'] as const;
export const LIMB_ROLES = ['leg', 'arm'] as const;

/** Item ids: lowercase, no dots (mirrored copies get `.L` and `.R`). */
export const ITEM_ID = /^[a-z][a-z0-9_-]*$/;
/** Palette colour names, e.g. `base`, `belly`, `accent`, `hornTip`. */
export const PALETTE_NAME = /^[a-z][a-zA-Z0-9]*$/;

export const DEFAULT_PALETTE = { base: '#7a6a50', belly: '#d9cdb0', accent: '#3b2e22' };

/** Module ids the schema offers as enums. Empty lists fall back to plain strings. */
export interface ModuleIds {
  bodyPlan: readonly string[];
  part: readonly string[];
  foot: readonly string[];
  pattern: readonly string[];
  gait: readonly string[];
  action: readonly string[];
}

const NO_IDS: ModuleIds = { bodyPlan: [], part: [], foot: [], pattern: [], gait: [], action: [] };

function idEnum(ids: readonly string[], what: string) {
  return ids.length > 0
    ? z.enum(ids as [string, ...string[]]).describe(`${what} id`)
    : z.string().describe(`${what} id`);
}

const range = (min: number, max: number) => z.number().min(min).max(max);

/** One number, or a list spread evenly along the section and smoothly interpolated. */
function profile(min: number, max: number, description: string) {
  const value = range(min, max);
  return z.union([value, z.array(value).min(1).max(16)]).describe(description);
}

export const colorSchema = z
  .string()
  .refine(isColor, { message: 'not a colour' })
  .describe('Colour: "#rrggbb", "#rgb" or a CSS colour name');

/**
 * A palette name such as "accent", or a literal colour. Module params holding colours must be
 * named `color` or end in `Color` so validation and expansion resolve them.
 */
export function colorRef(fallback: string) {
  return z
    .string()
    .min(1)
    .default(fallback)
    .describe('A palette name such as "accent", or a colour such as "#2a1e14"');
}

export function buildBlueprintSchema(ids: ModuleIds = NO_IDS) {
  const torso = z
    .strictObject({
      radius: profile(
        0.02,
        1,
        'Radius from the neck end to the tail end, in torso lengths',
      ).default([0.14, 0.18, 0.16, 0.12]),
      arch: range(-0.5, 0.5)
        .default(0)
        .describe('Upward bow of the spine, as a share of torso length; negative sags'),
      pitch: range(-30, 90)
        .default(0)
        .describe(
          'Degrees the torso tilts nose-up: 0 is horizontal, about 75 for an upright biped',
        ),
      crossSection: z.enum(CROSS_SECTIONS).default('round').describe('Shape across the torso'),
      segments: z.number().int().min(3).max(12).default(6).describe('Spine bones in the torso'),
    })
    .describe('The main body. Its length is the blueprint `scale`.');

  const neck = z
    .strictObject({
      length: range(0, 1.5).default(0.3).describe('Neck length in torso lengths; 0 for no neck'),
      radius: profile(
        0.01,
        0.6,
        'Radius from the head end to the torso end, in torso lengths',
      ).default([0.07, 0.09]),
      pitch: range(-60, 90).default(20).describe('Degrees the neck rises above horizontal'),
      crossSection: z.enum(CROSS_SECTIONS).default('round').describe('Shape across the neck'),
      segments: z.number().int().min(1).max(8).default(3).describe('Bones in the neck'),
    })
    .describe('Joins the head to the front of the torso.');

  const head = z
    .strictObject({
      shape: z.enum(HEAD_SHAPES).default('round').describe('Overall head shape'),
      length: range(0.05, 1).default(0.28).describe('Snout tip to back of skull, in torso lengths'),
      radius: range(0.02, 0.6).default(0.1).describe('Skull radius in torso lengths'),
      jaw: z
        .boolean()
        .default(true)
        .describe('A hinged lower jaw, needed for bite, roar and teeth'),
      pitch: range(-60, 60).default(0).describe('Degrees the snout points above horizontal'),
      crossSection: z.enum(CROSS_SECTIONS).default('round').describe('Shape across the head'),
    })
    .describe('The head. `at` runs from the snout tip (0) to the back of the skull (1).');

  const tail = z
    .strictObject({
      length: range(0, 4).default(0.6).describe('Tail length in torso lengths; 0 for no tail'),
      radius: profile(0.005, 0.6, 'Radius from the root to the tip, in torso lengths').default([
        0.08, 0.012,
      ]),
      curl: range(-360, 360)
        .default(0)
        .describe('Total degrees the tail bends upward along its length; negative curls down'),
      curlStart: range(0, 0.95)
        .default(0)
        .describe(
          'Share of the tail that stays straight before the curl begins; 0.6 curls only the end',
        ),
      crossSection: z.enum(CROSS_SECTIONS).default('round').describe('Shape across the tail'),
      pitch: range(-90, 60)
        .default(-10)
        .describe('Degrees the tail root points above horizontal; negative droops'),
      segments: z.number().int().min(2).max(24).default(8).describe('Bones in the tail'),
    })
    .describe('Runs back from the torso. `at` runs from the root (0) to the tip (1).');

  const side = z.enum(SIDES).describe('"both" makes a mirrored pair with ids ending .L and .R');

  const limbAttach = z.strictObject({
    on: z.string().default('torso').describe('Body section the limb grows from'),
    at: range(0, 1)
      .default(0.5)
      .describe('Where along the section: 0 is the snout end, 1 the tail end'),
    side: side.default('both'),
    angle: range(0, 180)
      .default(100)
      .describe('Degrees around the section from the top: 90 is the side, 180 the belly'),
  });

  const foot = z
    .object({ type: idEnum(ids.foot, 'Foot part').default('foot.claw') })
    .catchall(z.unknown())
    .describe('Foot part at the limb tip; its parameters sit beside `type`');

  const limb = z.strictObject({
    id: z.string().regex(ITEM_ID).describe('Unique id; mirrored copies get .L and .R'),
    role: z
      .enum(LIMB_ROLES)
      .default('leg')
      .describe('"leg" limbs carry the body; "arm" limbs are free'),
    attach: limbAttach.prefault({}),
    length: range(0.05, 3).default(0.5).describe('Total limb length in torso lengths'),
    segments: z
      .number()
      .int()
      .min(2)
      .max(4)
      .default(3)
      .describe('Bones from hip or shoulder to ankle'),
    radius: profile(0.005, 0.5, 'Radius from root to tip, in torso lengths').default([0.06, 0.03]),
    splay: range(-30, 90)
      .default(0)
      .describe('Degrees the limb swings out from under the body; about 50 for sprawlers'),
    foot: z
      .union([foot, z.null()])
      .prefault({})
      .describe('Foot part at the limb tip (default { "type": "foot.claw" }), or null for none'),
    remove: z.literal(true).optional().describe('Delete an inherited limb with this id'),
  });

  const partAttach = z.strictObject({
    on: z.string().optional().describe('Body section, limb id or part id to attach to'),
    at: range(0, 1)
      .optional()
      .describe('Where along it: snout-to-tail on sections, root-to-tip on limbs and parts'),
    from: range(0, 1).optional().describe('Start of a row'),
    to: range(0, 1).optional().describe('End of a row'),
    angle: range(0, 180)
      .optional()
      .describe('Degrees around the section from the top: 0 dorsal, 90 side, 180 belly'),
    side: side.optional().describe('Defaults to "both", or "center" when angle is 0 or 180'),
  });

  const part = z.strictObject({
    id: z.string().regex(ITEM_ID).describe('Unique id; mirrored copies get .L and .R'),
    type: idEnum(ids.part, 'Part module'),
    attach: partAttach.prefault({}),
    params: z.record(z.string(), z.unknown()).default({}).describe("The part module's parameters"),
    remove: z.literal(true).optional().describe('Delete an inherited part with this id'),
  });

  const layer = z
    .object({
      type: idEnum(ids.pattern, 'Pattern module'),
      id: z
        .string()
        .regex(ITEM_ID)
        .optional()
        .describe('Optional id; keys the layer random stream'),
      region: z.enum(REGIONS).default('all').describe('Where the layer shows'),
      strength: range(0, 1).default(1).describe('Layer opacity'),
    })
    .catchall(z.unknown())
    .describe('One pattern layer; its parameters sit beside `type`');

  const palette = z
    .object({ base: colorSchema, belly: colorSchema, accent: colorSchema })
    .catchall(colorSchema)
    .partial()
    .describe('Named colours. base, belly and accent always exist; add any others by name');

  const skin = z.strictObject({
    palette: palette.default({}),
    material: z.enum(SKIN_MATERIALS).default('skin').describe('Base surface under the patterns'),
    layers: z
      .array(layer)
      .max(12)
      .prefault([{ type: 'countershade' }])
      .describe('Pattern stack, bottom first'),
  });

  const moduleRef = (kind: readonly string[], what: string) =>
    z.union([idEnum(kind, what), z.object({ type: idEnum(kind, what) }).catchall(z.unknown())]);

  const motion = z.strictObject({
    temperament: z
      .enum(TEMPERAMENTS)
      .default('calm')
      .describe('Sets pace, posture and idle behaviour'),
    gaits: z
      .array(moduleRef(ids.gait, 'Gait'))
      .max(6)
      .optional()
      .describe('Gaits it may use; by default every gait that suits its legs'),
    actions: z
      .array(moduleRef(ids.action, 'Action'))
      .max(12)
      .default([])
      .describe('Actions it can perform'),
  });

  return z.strictObject({
    format: z.literal(FORMAT).describe('Format id and version'),
    name: z.string().min(1).max(80).default('Unnamed creature'),
    seed: z
      .number()
      .int()
      .min(0)
      .max(4294967295)
      .default(1)
      .describe('Same blueprint and seed, same monster'),
    extends: idEnum(ids.bodyPlan, 'Body plan')
      .optional()
      .describe('Body-plan preset to start from'),
    scale: range(0.05, 20)
      .default(1)
      .describe('Torso length in metres; every other length is a multiple of it'),
    body: z
      .strictObject({
        torso: torso.prefault({}),
        neck: neck.prefault({}),
        head: head.prefault({}),
        tail: tail.prefault({}),
      })
      .prefault({}),
    limbs: z
      .array(limb)
      .max(16)
      .default([])
      .describe('Legs and arms. Lists merge with the preset by id'),
    parts: z
      .array(part)
      .max(64)
      .default([])
      .describe('Hard parts. Lists merge with the preset by id'),
    skin: skin.prefault({}),
    motion: motion.prefault({}),
  });
}

export type BlueprintSchema = ReturnType<typeof buildBlueprintSchema>;
/** A blueprint after defaults, before module params and mirroring are resolved. */
export type BlueprintDoc = z.output<BlueprintSchema>;
export type LimbDoc = BlueprintDoc['limbs'][number];
export type PartDoc = BlueprintDoc['parts'][number];
export type LayerDoc = BlueprintDoc['skin']['layers'][number];
