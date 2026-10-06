import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'mottle',
  summary: 'Soft, cloudy blotches of a second colour that break up the outline.',
  tags: ['camouflage', 'texture'],
  params: z.strictObject({
    color: colorRef('accent'),
    scale: z.number().min(0.01).max(1).default(0.15).describe('Blotch size in torso lengths'),
    contrast: z.number().min(0).max(1).default(0.5).describe('How sharp the blotch edges are'),
    coverage: z.number().min(0).max(1).default(0.5).describe('Share of the skin covered'),
  }),
  example: { type: 'mottle', color: 'accent', scale: 0.2, coverage: 0.4 },
});
