import { colorName, colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'veins',
  summary: 'Branching veins under thin skin, darker or glowing.',
  tags: ['detail', 'gross'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('#5a1a2a').describe('Vein colour: a palette name or a colour'),
    density: z.number().min(0).max(1).default(0.5).describe('How many branches'),
    width: z.number().min(0.001).max(0.05).default(0.006).describe('Vein width in torso lengths'),
    raised: z.number().min(0).max(1).default(0.3).describe('How far the veins stand out'),
  }),
  example: { type: 'veins', color: '#6a1030', density: 0.6, region: 'head' },
  describe: (p) => `${colorName(p.color as string)} veins`,
});
