import { colorName, colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'warts',
  summary: 'Raised bumps and warts, like a toad or a troll.',
  tags: ['detail', 'gross'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('accent').describe('Wart colour: a palette name or a colour'),
    size: z.number().min(0.005).max(0.2).default(0.025).describe('Wart radius in torso lengths'),
    density: z.number().min(0).max(1).default(0.5).describe('Share of possible warts that appear'),
    height: z.number().min(0).max(1).default(0.6).describe('How far the warts stand out'),
  }),
  example: { type: 'warts', color: 'accent', size: 0.02, density: 0.6, region: 'back' },
  describe: (p) => `${colorName(p.color as string)} warts`,
});
