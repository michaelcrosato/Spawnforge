import { definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'foot.claw',
  summary:
    'Foot or hand of short toes, each tipped with a curved claw; set it as a limb\'s "foot".',
  tags: ['foot', 'hand', 'weapon'],
  slot: 'foot',
  material: 'horn',
  attach: { on: 'limb' },
  params: z.strictObject({
    toes: z.number().int().min(1).max(6).default(3).describe('Toes (or fingers) per foot'),
    toeLength: z.number().min(0.01).max(0.5).default(0.08).describe('Toe length in torso lengths'),
    spread: z.number().min(0).max(150).default(50).describe('Degrees between the outermost toes'),
    clawLength: z
      .number()
      .min(0)
      .max(0.3)
      .default(0.035)
      .describe('Claw length in torso lengths; 0 for none'),
    clawCurve: z.number().min(0).max(180).default(70).describe('Degrees each claw bends down'),
  }),
  example: { type: 'foot.claw', toes: 3, clawLength: 0.05 },
});
