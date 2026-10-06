import { defineGait } from '@spawnforge/core';
import { z } from 'zod';

export default defineGait({
  id: 'walk',
  summary: 'Slow gait for any leg count: feet lift one after another, back to front.',
  tags: ['legs', 'slow'],
  legPairs: 'any',
  wave: (pairs) => (pairs <= 1 ? 0.5 : pairs === 2 ? 0.25 : 1 / pairs),
  duty: 0.7,
  froude: [0, 0.5],
  params: z.strictObject({
    duty: z
      .number()
      .min(0.4)
      .max(0.95)
      .optional()
      .describe('Share of the cycle each foot is planted; defaults by leg count'),
    stepHeight: z
      .number()
      .min(0)
      .max(1)
      .default(0.15)
      .describe('Foot lift as a share of hip height'),
    stride: z.number().min(0.2).max(2).default(1).describe('Stride length multiplier'),
  }),
});
