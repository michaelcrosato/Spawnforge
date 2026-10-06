import { colorName, colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'rosettes',
  summary: 'Leopard-like rosettes: broken rings of dark marks around a tinted centre.',
  tags: ['camouflage', 'cat'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('accent').describe('Ring colour: a palette name or a colour'),
    centerColor: colorRef('base').describe('Colour inside each ring'),
    size: z.number().min(0.01).max(0.4).default(0.06).describe('Rosette radius in torso lengths'),
    density: z
      .number()
      .min(0)
      .max(1)
      .default(0.7)
      .describe('Share of possible rosettes that appear'),
    broken: z
      .number()
      .min(0)
      .max(1)
      .default(0.6)
      .describe('How broken each ring is into separate marks'),
  }),
  example: { type: 'rosettes', color: 'accent', size: 0.05, region: 'back' },
  describe: (p) => `${colorName(p.color as string)} rosettes`,
});
