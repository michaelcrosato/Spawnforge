import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'pinch',
  summary: 'Snaps a pincer shut on a target; fires a pinch-contact event.',
  tags: ['attack'],
  planned: '9.4',
  needs: ['pincer'],
  params: z.strictObject({
    speed: z.number().min(0.25).max(3).default(1).describe('Speed multiplier'),
    both: z.boolean().default(false).describe('Snap both pincers together'),
  }),
});
