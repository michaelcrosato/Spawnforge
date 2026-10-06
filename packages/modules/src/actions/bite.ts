import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'bite',
  summary: 'Lunges the head at a target and snaps the jaw shut; fires a bite-contact event.',
  tags: ['attack', 'mouth'],
  needs: ['jaw'],
  params: z.strictObject({
    reach: z
      .number()
      .min(0)
      .max(1)
      .default(0.7)
      .describe('How far the neck may stretch, as a share of its reach'),
    speed: z.number().min(0.25).max(4).default(1).describe('Speed multiplier'),
  }),
});
