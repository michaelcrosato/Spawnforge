import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'hood',
  summary: "A cobra's hood: neck ribs that spread the skin into a flat shield in display.",
  tags: ['neck', 'display', 'snake'],
  planned: '9.5',
  slot: 'surface',
  material: 'skin',
  attach: { on: 'neck', at: 0.3, angle: 0 },
  provides: ['display'],
  params: z.strictObject({
    width: z
      .number()
      .min(0.05)
      .max(1)
      .default(0.25)
      .describe('Hood width when spread, in torso lengths'),
    length: z.number().min(0.1).max(1).default(0.5).describe('Share of the neck the hood covers'),
    open: z.number().min(0).max(1).default(0.3).describe('How spread it is at rest'),
    markColor: colorRef('belly').describe('Colour of the eye marks on the back of the hood'),
  }),
  example: { id: 'hood', type: 'hood', params: { width: 0.3 } },
  describe: () => 'a hood',
});
