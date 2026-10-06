import type { ModuleDefinition, ModuleKind, Registry } from '../registry.ts';
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

/**
 * Runs each module's `normalize` hook on its parameters, in place, after the blueprint is merged
 * with its preset (so items that only override inherited parts still find their module). Item
 * objects keep their identity, so error paths still find them.
 */
export function normalizeModules(doc: Record<string, unknown>, registry: Registry): void {
  const hook = (kind: ModuleKind, type: unknown): ModuleDefinition['normalize'] =>
    typeof type === 'string' ? registry.get(kind, type)?.normalize : undefined;
  const fields = (
    record: Record<string, unknown>,
    kind: ModuleKind,
    keep: readonly string[],
  ): void => {
    const normalize = hook(kind, record.type);
    if (!normalize) return;
    const params = Object.fromEntries(Object.entries(record).filter(([k]) => !keep.includes(k)));
    const out = normalize(params, {});
    for (const k of Object.keys(record)) if (!keep.includes(k)) delete record[k];
    Object.assign(record, out);
  };
  for (const part of Array.isArray(doc.parts) ? doc.parts : []) {
    if (!isRecord(part) || part.remove === true || !isRecord(part.params)) continue;
    const module = typeof part.type === 'string' ? registry.get('part', part.type) : undefined;
    if (!module?.normalize) continue;
    const attach = isRecord(part.attach) ? part.attach : {};
    const at = typeof attach.at === 'number' ? attach.at : module.attach.at;
    const angle = typeof attach.angle === 'number' ? attach.angle : module.attach.angle;
    part.params = module.normalize(part.params, {
      attach: {
        on: typeof attach.on === 'string' ? attach.on : module.attach.on,
        ...(at !== undefined ? { at } : {}),
        ...(angle !== undefined ? { angle } : {}),
      },
    });
  }
  for (const limb of Array.isArray(doc.limbs) ? doc.limbs : [])
    if (isRecord(limb) && isRecord(limb.foot)) fields(limb.foot, 'part', ['type']);
  const skin = doc.skin;
  if (isRecord(skin) && Array.isArray(skin.layers))
    for (const layer of skin.layers)
      if (isRecord(layer)) fields(layer, 'pattern', ['type', 'id', 'region', 'strength']);
  const motion = doc.motion;
  if (isRecord(motion))
    for (const [key, kind] of [
      ['gaits', 'gait'],
      ['actions', 'action'],
    ] as const)
      for (const ref of Array.isArray(motion[key]) ? motion[key] : [])
        if (isRecord(ref)) fields(ref, kind, ['type']);
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
