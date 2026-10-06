import { colorName, colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'scars',
  summary: 'Old healed scars: pale, raised streaks and claw rakes across the skin.',
  tags: ['detail', 'battle'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('belly').describe('Scar colour: a palette name or a colour'),
    count: z.number().int().min(1).max(40).default(6).describe('How many scars over the body'),
    length: z.number().min(0.02).max(0.6).default(0.15).describe('Scar length in torso lengths'),
    rake: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(1)
      .describe('Parallel cuts per scar: 3 or 4 read as claw marks'),
    depth: z.number().min(0).max(1).default(0.5).describe('How raised and creased the scars are'),
  }),
  example: { type: 'scars', color: 'belly', count: 5, rake: 3, region: 'torso' },
  describe: (p) => `${colorName(p.color as string)} scars`,
});
