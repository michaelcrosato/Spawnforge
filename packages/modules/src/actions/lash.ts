import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'lash',
  summary: 'Whips the tail or a tentacle at a target; fires a lash-contact event.',
  tags: ['attack'],
  planned: '9.4',
  needs: [['tail', 'tentacle']],
  params: z.strictObject({
    speed: z.number().min(0.25).max(3).default(1).describe('Speed multiplier'),
    arc: z.number().min(20).max(180).default(90).describe('Degrees the strike sweeps'),
  }),
});
