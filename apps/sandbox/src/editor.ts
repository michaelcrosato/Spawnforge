import {
  blueprintSchemaFor,
  type CreatureSpec,
  formatIssue,
  type Issue,
  paramsJsonSchema,
  type Registry,
  validateBlueprint,
} from '@spawnforge/core';

type Json = Record<string, unknown>;
type Schema = {
  type?: string | string[];
  minimum?: number;
  maximum?: number;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  description?: string;
};

const isRecord = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A numeric range from a JSON schema node (looking through unions). */
function rangeOf(
  schema: Schema | undefined,
): { min: number; max: number; int: boolean } | undefined {
  if (!schema) return undefined;
  if (typeof schema.minimum === 'number' && typeof schema.maximum === 'number') {
    const int = schema.type === 'integer';
    return { min: schema.minimum, max: schema.maximum, int };
  }
  for (const option of [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]) {
    const r = rangeOf(option);
    if (r) return r;
  }
  return undefined;
}

function at(schema: Schema | undefined, path: readonly string[]): Schema | undefined {
  let node = schema;
  for (const key of path) {
    if (!node) return undefined;
    const props =
      node.properties ??
      [...(node.anyOf ?? []), ...(node.oneOf ?? [])].find((s) => s.properties)?.properties;
    node = props?.[key] ?? (key === '[]' ? node.items : undefined);
  }
  return node;
}

/** One slider: where it writes in the blueprint, and its range. */
interface SliderDef {
  readonly group: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  /** Writes the value into the blueprint (creating objects and list items as needed). */
  readonly set: (blueprint: Json, value: number) => void;
}

function ensure(parent: Json, key: string): Json {
  const value = parent[key];
  if (isRecord(value)) return value;
  const created: Json = {};
  parent[key] = created;
  return created;
}

/** The item with `id` in `blueprint[list]`, added if missing (lists merge by id). */
function item(blueprint: Json, list: string, id: string): Json {
  const items = Array.isArray(blueprint[list]) ? (blueprint[list] as unknown[]) : [];
  blueprint[list] = items;
  let found = items.find((x) => isRecord(x) && x.id === id) as Json | undefined;
  if (!found) {
    found = { id };
    items.push(found);
  }
  return found;
}

/** Sliders for the creature's main numbers, ranges taken from the schema. */
export function slidersFor(spec: CreatureSpec, registry: Registry): SliderDef[] {
  const schema = paramsJsonSchema(blueprintSchemaFor(registry)) as Schema;
  const defs: SliderDef[] = [];
  const add = (
    group: string,
    label: string,
    node: Schema | undefined,
    value: unknown,
    set: SliderDef['set'],
  ) => {
    const range = rangeOf(node);
    if (!range || typeof value !== 'number') return;
    const span = range.max - range.min;
    const step = range.int ? 1 : span > 50 ? 1 : span > 5 ? 0.05 : 0.005;
    defs.push({ group, label, min: range.min, max: range.max, step, value, set });
  };
  add('body', 'scale (m)', at(schema, ['scale']), spec.scale, (b, v) => {
    b.scale = v;
  });
  const body = spec.body as unknown as Record<string, Record<string, unknown>>;
  const fields: Record<string, string[]> = {
    torso: ['pitch', 'arch'],
    neck: ['length', 'pitch'],
    head: ['length', 'radius', 'pitch'],
    tail: ['length', 'pitch', 'curl', 'curlStart'],
  };
  for (const [section, keys] of Object.entries(fields)) {
    for (const key of keys) {
      add(section, key, at(schema, ['body', section, key]), body[section]?.[key], (b, v) => {
        ensure(ensure(b, 'body'), section)[key] = v;
      });
    }
  }
  const limbSchema = at(schema, ['limbs', '[]']);
  const seen = new Set<string>();
  for (const limb of spec.limbs) {
    if (seen.has(limb.baseId)) continue;
    seen.add(limb.baseId);
    const keys = limb.role === 'arm' ? ['length', 'lift'] : ['length', 'splay'];
    for (const key of keys)
      add(
        `limb ${limb.baseId}`,
        key,
        at(limbSchema, [key]),
        (limb as unknown as Json)[key],
        (b, v) => {
          item(b, 'limbs', limb.baseId)[key] = v;
        },
      );
    add(`limb ${limb.baseId}`, 'at', at(limbSchema, ['attach', 'at']), limb.at, (b, v) => {
      ensure(item(b, 'limbs', limb.baseId), 'attach').at = v;
    });
  }
  seen.clear();
  for (const part of spec.parts) {
    if (seen.has(part.baseId)) continue;
    seen.add(part.baseId);
    const module = registry.get('part', part.type);
    if (!module) continue;
    const params = paramsJsonSchema(module.params) as Schema;
    for (const [key, node] of Object.entries(params.properties ?? {}))
      add(`part ${part.baseId}`, key, node, part.params[key], (b, v) => {
        ensure(item(b, 'parts', part.baseId), 'params')[key] = v;
      });
  }
  spec.skin.layers.forEach((layer, i) => {
    const module = registry.get('pattern', layer.type);
    if (!module) return;
    const params = paramsJsonSchema(module.params) as Schema;
    const write = (b: Json, key: string, v: number) => {
      // Layers replace the inherited list, so copy the resolved list in before editing one.
      const skin = ensure(b, 'skin');
      if (!Array.isArray(skin.layers))
        skin.layers = spec.skin.layers.map((l) => ({
          type: l.type,
          region: l.region,
          strength: l.strength,
          ...l.params,
        }));
      const target = (skin.layers as unknown[])[i];
      if (isRecord(target)) target[key] = v;
    };
    add(
      `layer ${i + 1} ${layer.type}`,
      'strength',
      { minimum: 0, maximum: 1 },
      layer.strength,
      (b, v) => write(b, 'strength', v),
    );
    for (const [key, node] of Object.entries(params.properties ?? {}))
      add(`layer ${i + 1} ${layer.type}`, key, node, layer.params[key], (b, v) => write(b, key, v));
  });
  return defs;
}

export interface Editor {
  /** Shows a blueprint (from the picker, gallery or a file change). */
  load(blueprint: Json): void;
}

/**
 * The editing panel: sliders for the main numbers and the blueprint as JSON. Every change is
 * validated; valid blueprints go to `onChange` (debounced), errors are listed under the JSON.
 */
export function createEditor(
  registry: Registry,
  elements: { sliders: HTMLElement; json: HTMLTextAreaElement; issues: HTMLElement },
  onChange: (blueprint: Json) => void,
): Editor {
  let blueprint: Json = {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  const showIssues = (errors: readonly Issue[], warnings: readonly Issue[]) => {
    elements.issues.replaceChildren(
      ...[...errors, ...warnings].map((issue) => {
        const line = document.createElement('div');
        line.className = issue.severity;
        line.textContent = formatIssue(issue);
        return line;
      }),
    );
    if (errors.length === 0 && warnings.length === 0) elements.issues.textContent = 'valid';
  };

  const check = (fromJson: boolean) => {
    const result = validateBlueprint(blueprint, registry, { minimal: false });
    showIssues(result.errors, result.warnings);
    if (!result.ok || !result.creature) return;
    if (fromJson) buildSliders(result.creature);
    clearTimeout(timer);
    timer = setTimeout(() => onChange(structuredClone(blueprint)), 120);
  };

  const buildSliders = (spec: CreatureSpec) => {
    const groups = new Map<string, HTMLElement>();
    elements.sliders.replaceChildren();
    for (const def of slidersFor(spec, registry)) {
      let group = groups.get(def.group);
      if (!group) {
        group = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = def.group;
        group.append(legend);
        groups.set(def.group, group);
        elements.sliders.append(group);
      }
      const row = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = def.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(def.value);
      const value = document.createElement('output');
      value.textContent = String(def.value);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        value.textContent = String(v);
        def.set(blueprint, v);
        elements.json.value = JSON.stringify(blueprint, null, 2);
        check(false);
      });
      row.append(name, input, value);
      group.append(row);
    }
  };

  elements.json.addEventListener('input', () => {
    try {
      const parsed = JSON.parse(elements.json.value) as unknown;
      if (!isRecord(parsed)) throw new Error('a blueprint is a JSON object');
      blueprint = parsed;
      check(true);
    } catch (error) {
      elements.issues.textContent = `JSON: ${(error as Error).message}`;
    }
  });

  return {
    load(next) {
      blueprint = structuredClone(next);
      elements.json.value = JSON.stringify(blueprint, null, 2);
      const result = validateBlueprint(blueprint, registry, { minimal: false });
      showIssues(result.errors, result.warnings);
      if (result.creature) buildSliders(result.creature);
    },
  };
}
