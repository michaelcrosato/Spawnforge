import { defineGait } from '@spawnforge/core';
import { z } from 'zod';

export default defineGait({
  id: 'run',
  summary: 'Two-legged running with a moment in the air each stride, for raptors and runners.',
  tags: ['legs', 'fast'],
  planned: '10.1',
  legPairs: [1],
  wave: () => 0.5,
  duty: 0.35,
  froude: [0.5, 3],
  params: z.strictObject({
    duty: z
      .number()
      .min(0.2)
      .max(0.5)
      .optional()
      .describe('Share of the cycle each foot is planted'),
    stride: z.number().min(0.2).max(2).default(1).describe('Stride length multiplier'),
    lean: z.number().min(0).max(45).default(15).describe('Degrees the body leans forward at speed'),
  }),
});
