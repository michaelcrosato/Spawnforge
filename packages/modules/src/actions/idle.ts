import { defineAction } from '@spawnforge/core';
import { z } from 'zod';

export default defineAction({
  id: 'idle',
  summary: 'Breathing, weight shifts, glances, tail swish and blinks while standing.',
  tags: ['ambient'],
  needs: [],
  params: z.strictObject({
    breath: z.number().min(0).max(1).default(0.5).describe('Breathing depth'),
    fidget: z.number().min(0).max(1).default(0.5).describe('How often it shifts and looks around'),
  }),
});
