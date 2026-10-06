import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'roar',
  summary: 'Raises the head and opens the jaw wide; fires a roar-peak event.',
  tags: ['display', 'mouth'],
  needs: ['jaw'],
  params: z.strictObject({
    duration: z
      .number()
      .min(0.5)
      .max(6)
      .default(2)
      .describe('Seconds for a creature with 1 m hips; scales with size'),
    intensity: z
      .number()
      .min(0)
      .max(1)
      .default(0.8)
      .describe('How wide the jaw opens and how far the head rises'),
  }),
});
