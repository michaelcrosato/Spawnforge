import { defineGait } from '@spawnforge/core';
import { z } from 'zod';

export default defineGait({
  id: 'bound',
  summary:
    'Small quadrupeds leaping with both hind legs, then both front legs, like a rabbit or a weasel.',
  tags: ['legs', 'fast', 'small'],
  planned: '10.1',
  legPairs: [2],
  wave: () => 0.5,
  duty: 0.3,
  froude: [1, 5],
  params: z.strictObject({
    flex: z.number().min(0).max(1).default(0.7).describe('How much the spine flexes each bound'),
    stride: z.number().min(0.2).max(2).default(1).describe('Stride length multiplier'),
  }),
});
