import { definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'horn.curved',
  summary: 'Tapered horn bent along an arc; use side "both" for a pair.',
  tags: ['head', 'weapon', 'bone'],
  slot: 'surface',
  material: 'horn',
  attach: { on: 'head', at: 0.75, angle: 40 },
  params: z.strictObject({
    length: z.number().min(0.02).max(1).default(0.2).describe('Length in torso lengths'),
    width: z.number().min(0.005).max(0.3).default(0.035).describe('Base radius in torso lengths'),
    curve: z
      .number()
      .min(-270)
      .max(270)
      .default(45)
      .describe('Total bend in degrees; positive sweeps back toward the tail'),
    twist: z
      .number()
      .min(-720)
      .max(720)
      .default(0)
      .describe('Spiral in degrees along the horn, like a ram'),
    lean: z
      .number()
      .min(-90)
      .max(90)
      .default(0)
      .describe('Degrees the root tilts forward (+) or back (-)'),
    ridges: z.number().int().min(0).max(30).default(0).describe('Rings along the horn'),
  }),
  example: {
    id: 'horns',
    type: 'horn.curved',
    attach: { on: 'head', at: 0.75, angle: 40, side: 'both' },
    params: { length: 0.25, curve: 60 },
  },
});
