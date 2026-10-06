import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'countershade',
  summary: 'Paler belly blending into a darker back, as on most animals.',
  tags: ['base', 'camouflage'],
  params: z.strictObject({
    color: colorRef('belly').describe('Belly colour: a palette name or a colour'),
    height: z
      .number()
      .min(-1)
      .max(1)
      .default(-0.1)
      .describe('Where the blend sits: -1 belly, 0 flank, 1 back'),
    softness: z.number().min(0.01).max(1).default(0.35).describe('Width of the blend'),
  }),
  example: { type: 'countershade', strength: 0.6 },
});
