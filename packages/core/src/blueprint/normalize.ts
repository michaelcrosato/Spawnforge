import { toHex } from './colors.ts';
import { cloneJson, isRecord } from './merge.ts';

/**
 * Turns friendly forms into canonical ones, without validating: colour names and `#rgb` become
 * `#rrggbb`, and `{ "type": "walk" }` with no parameters becomes `"walk"`. Anything it does not
 * recognize is left alone for validation to report.
 */
export function normalizeBlueprint(doc: Record<string, unknown>): Record<string, unknown> {
  const out = cloneJson(doc);
  const skin = out.skin;
  if (isRecord(skin)) {
    if (isRecord(skin.palette)) {
      for (const [name, value] of Object.entries(skin.palette)) {
        if (typeof value === 'string') skin.palette[name] = toHex(value) ?? value;
      }
    }
    if (Array.isArray(skin.layers)) {
      for (const layer of skin.layers) if (isRecord(layer)) normalizeColorFields(layer);
    }
  }
  if (Array.isArray(out.parts)) {
    for (const part of out.parts) {
      if (isRecord(part) && isRecord(part.params)) normalizeColorFields(part.params);
    }
  }
  const motion = out.motion;
  if (isRecord(motion)) {
    for (const key of ['gaits', 'actions'] as const) {
      const list = motion[key];
      if (Array.isArray(list)) {
        motion[key] = list.map((item) =>
          isRecord(item) && typeof item.type === 'string' && Object.keys(item).length === 1
            ? item.type
            : item,
        );
      }
    }
  }
  return out;
}

/** Fields named `color` or ending in `Color` hold a palette name or a colour. */
export const isColorField = (key: string): boolean => key === 'color' || key.endsWith('Color');

function normalizeColorFields(record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    if (isColorField(key) && typeof value === 'string' && (value.startsWith('#') || toHex(value))) {
      // Palette names win over CSS names: "accent" is not a CSS colour, but "tan" could be either.
      if (value.startsWith('#')) record[key] = toHex(value) ?? value;
    }
  }
}
