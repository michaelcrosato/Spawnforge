import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'mandible',
  summary: 'A pair of hinged mandibles or fangs at the mouth corners that close with the bite.',
  tags: ['head', 'mouth', 'insect', 'weapon'],
  planned: '9.4',
  slot: 'mouth',
  material: 'chitin',
  attach: { on: 'head' },
  provides: ['mandibles'],
  params: z.strictObject({
    length: z
      .number()
      .min(0.02)
      .max(0.6)
      .default(0.15)
      .describe('Mandible length in torso lengths'),
    curve: z.number().min(0).max(180).default(70).describe('Degrees each mandible curves inward'),
    teeth: z.number().int().min(0).max(8).default(2).describe('Teeth along the inner edge'),
    shape: z
      .enum(['mandible', 'fang'])
      .default('mandible')
      .describe('"mandible" like an ant, "fang" like a spider\'s chelicerae'),
    color: colorRef('#2a2018').describe('Colour: a palette name or a colour'),
    tipColor: colorRef('#100a06').describe('Colour at the tips'),
  }),
  example: { id: 'mandibles', type: 'mandible', params: { length: 0.2 } },
  describe: (p) => (p.shape === 'fang' ? 'fangs' : 'mandibles'),
});
