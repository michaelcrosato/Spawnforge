import { defineGait } from '@spawnforge/core';
import { z } from 'zod';

export default defineGait({
  id: 'swim.paddle',
  summary: 'Swims at the surface by paddling its legs, like a dog or a bear.',
  tags: ['water', 'legs'],
  planned: '10.3',
  medium: 'water',
  needs: ['legs'],
  legPairs: 'any',
  wave: () => 0.5,
  duty: 0.5,
  froude: [0, 0.5],
  params: z.strictObject({
    stroke: z.number().min(0.2).max(2).default(1).describe('Stroke length multiplier'),
  }),
});
