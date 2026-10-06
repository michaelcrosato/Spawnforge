import { defineGait } from '@spawnforge/core';
import { z } from 'zod';

export default defineGait({
  id: 'swim.undulate',
  summary: 'Swims with a body wave that grows toward the tail, like a fish, an eel or a crocodile.',
  tags: ['water', 'body'],
  planned: '10.3',
  medium: 'water',
  legPairs: 'any',
  wave: () => 0,
  duty: 1,
  froude: [0, 1],
  params: z.strictObject({
    amplitude: z
      .number()
      .min(0)
      .max(1)
      .default(0.2)
      .describe('Tail-beat width as a share of body length'),
    waves: z.number().min(0.5).max(3).default(1).describe('Body waves along the length'),
  }),
});
