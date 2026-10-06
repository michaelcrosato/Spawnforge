import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'frill',
  summary:
    'A fan of spines with skin between them around the neck, folded at rest and opened in display.',
  tags: ['neck', 'display', 'reptile'],
  planned: '9.5',
  slot: 'surface',
  material: 'skin',
  attach: { on: 'neck', at: 0.1, angle: 0 },
  provides: ['display'],
  params: z.strictObject({
    radius: z
      .number()
      .min(0.05)
      .max(1)
      .default(0.3)
      .describe('Frill radius when open, in torso lengths'),
    spines: z.number().int().min(4).max(30).default(12).describe('Spines in the fan'),
    open: z.number().min(0).max(1).default(0.2).describe('How open it is at rest'),
    color: colorRef('accent').describe('Membrane colour: a palette name or a colour'),
    spineColor: colorRef('base').describe('Spine colour'),
  }),
  example: { id: 'frill', type: 'frill', params: { radius: 0.35, spines: 14 } },
  describe: () => 'a neck frill',
});
