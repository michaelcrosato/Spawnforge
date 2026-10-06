import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'pounce',
  summary: 'A jump that ends in a bite on the target; fires takeoff, land and bite-contact events.',
  tags: ['attack', 'move'],
  planned: '10.2',
  needs: ['legs', 'jaw'],
  params: z.strictObject({
    power: z.number().min(0).max(1).default(0.7).describe('How hard it springs, 0 to 1'),
    reach: z.number().min(0).max(1).default(0.8).describe('How far the head lunges at the end'),
  }),
});
