import { colorName, colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'bands',
  summary:
    'Wide, even rings of colour around the body and tail, like a coral snake or a lemur tail.',
  tags: ['warning'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('accent').describe('Band colour: a palette name or a colour'),
    count: z.number().int().min(1).max(64).default(8).describe('Bands from snout to tail tip'),
    width: z
      .number()
      .min(0.05)
      .max(0.95)
      .default(0.5)
      .describe('Band width as a share of the spacing'),
    sharpness: z.number().min(0).max(1).default(0.8).describe('How crisp the band edges are'),
  }),
  example: { type: 'bands', color: 'accent', count: 12, region: 'tail' },
  describe: (p) => `${colorName(p.color as string)} bands`,
});
