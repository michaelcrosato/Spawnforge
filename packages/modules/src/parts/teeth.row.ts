import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'teeth.row',
  summary: 'Teeth along the mouth line; the upper row moves with the head, the lower with the jaw.',
  tags: ['head', 'mouth', 'weapon'],
  slot: 'mouth',
  material: 'enamel',
  attach: { on: 'head' },
  params: z.strictObject({
    count: z.number().int().min(1).max(40).default(10).describe('Teeth per row on each side'),
    length: z.number().min(0.005).max(0.2).default(0.025).describe('Tooth length in torso lengths'),
    fangs: z
      .number()
      .int()
      .min(0)
      .max(4)
      .default(1)
      .describe('Long fangs at the front of each row'),
    fangLength: z
      .number()
      .min(0.01)
      .max(0.4)
      .default(0.06)
      .describe('Fang length in torso lengths'),
    upper: z.boolean().default(true).describe('Teeth in the upper row'),
    lower: z.boolean().default(true).describe('Teeth in the lower row'),
    color: colorRef('#efe8d0'),
  }),
  example: { id: 'teeth', type: 'teeth.row', params: { count: 12, fangs: 1 } },
});
