import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'display',
  summary:
    'Threat display: opens frills and hoods, raises quills and sails. Needs a part that provides `display`.',
  tags: ['display'],
  planned: '9.5',
  needs: ['display'],
  params: z.strictObject({
    duration: z
      .number()
      .min(0.5)
      .max(8)
      .default(2.5)
      .describe('Seconds for a creature with 1 m hips; scales with size'),
    intensity: z.number().min(0).max(1).default(1).describe('How far everything opens'),
  }),
});
