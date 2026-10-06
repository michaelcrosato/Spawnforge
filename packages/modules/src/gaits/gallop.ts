import { defineGait } from '@spawnforge/core';
import { z } from 'zod';

export default defineGait({
  id: 'gallop',
  summary: 'Fast four-legged gait with a leading leg and a moment in the air, like a horse.',
  tags: ['legs', 'fast'],
  planned: '10.1',
  legPairs: [2],
  wave: () => 0.1,
  duty: 0.3,
  froude: [2, 6],
  params: z.strictObject({
    style: z
      .enum(['transverse', 'rotary'])
      .default('transverse')
      .describe('"transverse" like a horse, "rotary" like a cheetah or a dog'),
    lead: z.enum(['left', 'right']).default('left').describe('Which front leg leads'),
    flex: z.number().min(0).max(1).default(0.4).describe('How much the spine flexes each stride'),
    stride: z.number().min(0.2).max(2).default(1).describe('Stride length multiplier'),
  }),
});
