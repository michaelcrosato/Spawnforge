import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'jump',
  summary:
    'Crouches, leaps to a target point or over a height and lands on its legs; fires takeoff and land events.',
  tags: ['move'],
  planned: '10.2',
  needs: ['legs'],
  params: z.strictObject({
    power: z.number().min(0).max(1).default(0.6).describe('How hard it springs, 0 to 1'),
    crouch: z.number().min(0).max(1).default(0.5).describe('How deep it crouches first'),
  }),
});
