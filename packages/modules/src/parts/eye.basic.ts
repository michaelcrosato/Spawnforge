import { colorName, colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

const params = z.strictObject({
  size: z.number().min(0.005).max(0.2).default(0.022).describe('Eyeball radius in torso lengths'),
  pupil: z.enum(['round', 'slit', 'goat']).default('round').describe('Pupil shape'),
  irisColor: colorRef('#c8a030').describe('Iris colour: a palette name or a colour'),
  scleraColor: colorRef('#e8e2cc').describe('Colour of the eyeball around the iris'),
  iris: z.number().min(0.2).max(1).default(0.7).describe('Iris size as a share of the visible eye'),
  bulge: z.number().min(0).max(1).default(0.5).describe('How far the eye stands out of the skin'),
});
type Params = z.output<typeof params>;

export default definePart({
  id: 'eye.basic',
  summary: 'Round eyeball with an iris and pupil that turns to look at targets and blinks.',
  tags: ['head', 'sense'],
  slot: 'surface',
  material: 'eye',
  attach: { on: 'head', at: 0.4, angle: 60 },
  params,
  example: {
    id: 'eyes',
    type: 'eye.basic',
    attach: { on: 'head', at: 0.4, angle: 60, side: 'both' },
    params: { size: 0.02, pupil: 'slit' },
  },
  describe(p) {
    const size = p.size as number;
    const big = size >= 0.05 ? 'big ' : size <= 0.015 ? 'small ' : '';
    const pupil =
      p.pupil === 'slit' ? 'slit-pupilled ' : p.pupil === 'goat' ? 'goat-pupilled ' : '';
    return `${big}${colorName(p.irisColor as string)} ${pupil}eyes`;
  },
  hooks: {
    build(ctx, raw) {
      const p = raw as Params;
      const radius = p.size * ctx.scale;
      const socket = ctx.socket();
      ctx.emit(ctx.geo.sphere(radius, 10, 18), socket, {
        sink: radius * (0.85 - p.bulge * 0.6),
        eye: {
          iris: ctx.color(p.irisColor, '#c8a030'),
          sclera: ctx.color(p.scleraColor, '#e8e2cc'),
          pupil: p.pupil,
          irisSize: p.iris,
          radius,
        },
      });
    },
  },
});
