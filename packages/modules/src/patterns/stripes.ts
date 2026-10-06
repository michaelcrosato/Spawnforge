import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'stripes',
  summary: 'Bands running across the spine (or along it), with optional wobble.',
  tags: ['camouflage', 'warning'],
  params: z.strictObject({
    color: colorRef('accent'),
    count: z.number().min(1).max(64).default(10).describe('Stripes from snout to tail tip'),
    width: z
      .number()
      .min(0.05)
      .max(0.95)
      .default(0.35)
      .describe('Stripe width as a share of the spacing'),
    jitter: z.number().min(0).max(1).default(0.3).describe('Wobble and irregularity'),
    direction: z
      .enum(['across', 'along'])
      .default('across')
      .describe('"across" the spine like a tiger, or "along" it'),
    fade: z.number().min(0).max(1).default(0.6).describe('How much stripes fade toward the belly'),
  }),
  example: { type: 'stripes', color: 'accent', count: 12, region: 'back', jitter: 0.4 },
});
