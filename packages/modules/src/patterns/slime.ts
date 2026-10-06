import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'slime',
  summary: 'A wet, glossy coat of slime with drips and a faint tint.',
  tags: ['wet', 'gross'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('#a8c890').describe('Slime tint: a palette name or a colour'),
    wetness: z
      .number()
      .min(0)
      .max(1)
      .default(0.8)
      .describe('How glossy the skin gets (1 is mirror-wet)'),
    drips: z.number().min(0).max(1).default(0.4).describe('How many drips run down the flanks'),
    tint: z.number().min(0).max(1).default(0.2).describe('How much the slime colours the skin'),
  }),
  example: { type: 'slime', wetness: 0.9, drips: 0.5 },
  describe: () => 'a coat of slime',
});
