import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

const params = z.strictObject({
  count: z.number().int().min(1).max(40).default(10).describe('Teeth per row on each side'),
  length: z.number().min(0.005).max(0.2).default(0.025).describe('Tooth length in torso lengths'),
  fangs: z.number().int().min(0).max(4).default(1).describe('Long fangs at the front of each row'),
  fangLength: z.number().min(0.01).max(0.4).default(0.06).describe('Fang length in torso lengths'),
  upper: z.boolean().default(true).describe('Teeth in the upper row'),
  lower: z.boolean().default(true).describe('Teeth in the lower row'),
  color: colorRef('#efe8d0'),
});
type Params = z.output<typeof params>;

export default definePart({
  id: 'teeth.row',
  summary: 'Teeth along the mouth line; the upper row moves with the head, the lower with the jaw.',
  tags: ['head', 'mouth', 'weapon'],
  slot: 'mouth',
  material: 'enamel',
  attach: { on: 'head' },
  params,
  example: { id: 'teeth', type: 'teeth.row', params: { count: 12, fangs: 1 } },
  describe(p) {
    const fangs = (p.fangs as number) > 0;
    if (fangs && (p.fangLength as number) >= 0.08) return 'long fangs';
    return fangs ? 'teeth and fangs' : 'teeth';
  },
  hooks: {
    build(ctx, raw) {
      const p = raw as Params;
      const color = ctx.color(p.color, '#efe8d0');
      const rows: ('upper' | 'lower')[] = [];
      if (p.upper) rows.push('upper');
      if (p.lower) rows.push('lower');
      for (const row of rows) {
        for (const side of [1, -1]) {
          for (let i = 0; i < p.count; i++) {
            const t = 0.05 + ((i + 0.5) / p.count) * 0.85;
            const socket = ctx.mouth(t, row, side);
            if (!socket) return;
            const fang = i < p.fangs;
            // Lower fangs are shorter, as in most jaws.
            const length =
              (fang ? p.fangLength * (row === 'lower' ? 0.7 : 1) : p.length * (1 - t * 0.4)) *
              ctx.scale;
            const base = length * (fang ? 0.2 : 0.3);
            const path = ctx.geo.arc(length, fang ? 18 : 8, { segments: 4 });
            const piece = ctx.geo.sweep(path, (u) => base * (1 - u * 0.95), {
              sides: 6,
              tip: 'point',
            });
            ctx.emit(piece, socket, { color, tipColor: color, sink: base * 0.8 });
          }
        }
      }
    },
  },
});
