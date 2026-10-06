import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'look',
  summary: 'Turns eyes, head and neck toward a target within limits.',
  tags: ['head', 'sense'],
  needs: ['head'],
  params: z.strictObject({
    speed: z.number().min(0.25).max(4).default(1).describe('Speed multiplier'),
    range: z
      .number()
      .min(10)
      .max(180)
      .default(100)
      .describe('Degrees the head may turn from straight ahead'),
  }),
});
