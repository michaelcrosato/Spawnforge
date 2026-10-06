import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'foot.talon',
  summary: 'A bird-like foot: three long toes forward, one back, each with a hooked talon.',
  tags: ['foot', 'bird', 'weapon'],
  planned: '8.2',
  slot: 'foot',
  material: 'horn',
  stance: 'digitigrade',
  attach: { on: 'limb' },
  params: z.strictObject({
    toeLength: z.number().min(0.02).max(0.5).default(0.12).describe('Toe length in torso lengths'),
    talonLength: z.number().min(0).max(0.3).default(0.05).describe('Talon length in torso lengths'),
    grip: z.number().min(0).max(1).default(0.3).describe('How curled the toes are at rest'),
    color: colorRef('#c8a040').describe('Scaly toe colour: a palette name or a colour'),
    talonColor: colorRef('#1e1a16').describe('Talon colour'),
  }),
  example: { type: 'foot.talon', toeLength: 0.14, talonLength: 0.06 },
  describe: (_, { count }) => (count === 1 ? 'a taloned foot' : 'talons'),
});
