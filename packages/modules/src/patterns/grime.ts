import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'grime',
  summary: 'Dirt gathered in creases, on the feet and low on the body; adds roughness.',
  tags: ['weathering'],
  params: z.strictObject({
    color: colorRef('#2a2218'),
    amount: z.number().min(0).max(1).default(0.5).describe('Overall strength'),
    creases: z.number().min(0).max(1).default(0.7).describe('Dirt in creases and joints'),
    feet: z.number().min(0).max(1).default(0.6).describe('Dirt rising from the ground up the legs'),
  }),
  example: { type: 'grime', amount: 0.4 },
});
