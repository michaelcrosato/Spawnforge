import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

const params = z.strictObject({
  length: z.number().min(0.02).max(1).default(0.2).describe('Length in torso lengths'),
  width: z.number().min(0.005).max(0.3).default(0.035).describe('Base radius in torso lengths'),
  curve: z
    .number()
    .min(-540)
    .max(540)
    .default(45)
    .describe(
      'Total bend in degrees; positive sweeps back toward the tail, negative forward; past 360 it coils',
    ),
  twist: z
    .number()
    .min(-720)
    .max(720)
    .default(0)
    .describe('Spiral in degrees along the horn, like a ram'),
  lean: z
    .number()
    .min(-90)
    .max(90)
    .default(0)
    .describe('Degrees the root tilts forward (+) or back (-)'),
  turn: z
    .number()
    .min(-180)
    .max(180)
    .default(0)
    .describe(
      'Degrees the bend turns sideways: 90 curves toward the midline (mandibles), -90 away from it',
    ),
  ridges: z.number().int().min(0).max(30).default(0).describe('Rings along the horn'),
  color: colorRef('#d4c6a2').describe('Colour at the root: a palette name or a colour'),
  tipColor: colorRef('#3d3329').describe('Colour at the tip'),
});
type Params = z.output<typeof params>;

export default definePart({
  id: 'horn.curved',
  summary: 'Tapered horn bent along an arc; use side "both" for a pair.',
  tags: ['head', 'weapon', 'bone'],
  slot: 'surface',
  material: 'horn',
  attach: { on: 'head', at: 0.75, angle: 40 },
  params,
  example: {
    id: 'horns',
    type: 'horn.curved',
    attach: { on: 'head', at: 0.75, angle: 40, side: 'both' },
    params: { length: 0.25, curve: 60 },
  },
  describe(p, { count }) {
    const curve = Math.abs(p.curve as number);
    const shape =
      curve > 300 ? 'coiled' : curve > 120 ? 'sweeping' : curve > 25 ? 'curved' : 'straight';
    const size = (p.length as number) > 0.4 ? 'long ' : (p.length as number) < 0.1 ? 'short ' : '';
    return count === 1 ? `a ${size}${shape} horn` : `${size}${shape} horns`;
  },
  hooks: {
    build(ctx, raw) {
      const p = raw as Params;
      const socket = ctx.socket();
      const length = p.length * ctx.scale;
      const width = Math.min(p.width * ctx.scale, length * 0.45);
      const segments = Math.max(
        8,
        Math.round(Math.abs(p.curve) / 15) + Math.round(Math.abs(p.twist) / 30) + 6,
      );
      const path = ctx.geo.arc(length, p.curve, {
        twist: p.twist,
        lean: p.lean,
        heading: -p.turn,
        segments,
      });
      const radius = (t: number) => width * (1 - t) ** 0.85 + width * 0.04;
      const piece = ctx.geo.sweep(path, radius, {
        sides: 12,
        tip: 'point',
        ridges: p.ridges,
        ridgeDepth: 0.14,
      });
      ctx.emit(piece, socket, {
        color: ctx.color(p.color, '#d4c6a2'),
        tipColor: ctx.color(p.tipColor, '#3d3329'),
        sink: width * 0.7,
        path: { points: path, radii: path.map((_, i) => radius(i / (path.length - 1))) },
      });
    },
  },
});
