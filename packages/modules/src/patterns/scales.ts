import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'scales',
  summary: 'Overlapping scales as bump and darker gaps between them.',
  tags: ['texture', 'reptile'],
  params: z.strictObject({
    size: z.number().min(0.005).max(0.2).default(0.02).describe('Scale size in torso lengths'),
    bump: z.number().min(0).max(1).default(0.4).describe('Depth of the scale relief'),
    gapColor: colorRef('accent').describe(
      'Colour in the gaps between scales: a palette name or a colour',
    ),
    gap: z.number().min(0).max(1).default(0.3).describe('How dark and wide the gaps are'),
  }),
  example: { type: 'scales', size: 0.02, bump: 0.4 },
});
