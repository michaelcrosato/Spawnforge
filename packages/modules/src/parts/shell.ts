import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'shell',
  summary:
    'A domed shell over an area of the body, divided into scutes, like a turtle or a tortoise.',
  tags: ['armor', 'shell'],
  planned: '9.5',
  slot: 'area',
  material: 'horn',
  attach: { on: 'torso', area: 'back', from: 0, to: 1 },
  params: z.strictObject({
    dome: z
      .number()
      .min(0)
      .max(1)
      .default(0.6)
      .describe('How domed: 0 flat, 1 a high tortoise shell'),
    thickness: z.number().min(0.005).max(0.2).default(0.03).describe('Thickness in torso lengths'),
    overhang: z
      .number()
      .min(0)
      .max(0.5)
      .default(0.12)
      .describe('How far the rim reaches past the body'),
    scutes: z
      .number()
      .int()
      .min(0)
      .max(30)
      .default(13)
      .describe('Plates on the shell; 0 for smooth'),
    color: colorRef('base').describe('Shell colour: a palette name or a colour'),
    seamColor: colorRef('accent').describe('Colour of the seams between scutes'),
  }),
  example: { id: 'shell', type: 'shell', params: { dome: 0.7 } },
  describe: (p) => ((p.dome as number) > 0.5 ? 'a domed shell' : 'a flat shell'),
});
