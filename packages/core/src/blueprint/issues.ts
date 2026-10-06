import type { z } from 'zod';
import { COLOR_NAMES } from './colors.ts';
import { didYouMean } from './suggest.ts';

/** Fixes for keys models tend to guess, keyed by `section.key` or just `key`. */
const HINTS: Record<string, string> = {
  'body.torso.length':
    'the torso length is the blueprint `scale` (metres); remove it and set "scale"',
  'body.torso.size': 'the torso length is the blueprint `scale` (metres); widths use "radius"',
  'body.head.size': 'use "length" and "radius"',
  colour: 'spelled "color"',
  wings: 'wings are not in this version; see docs/plan.md "Later"',
  legs: 'legs are items in the top-level "limbs" list with "role": "leg"',
  arms: 'arms are items in the top-level "limbs" list with "role": "arm"',
  size: 'sizes are relative: lengths and radii are multiples of the blueprint `scale`',
};

/** A problem found in a blueprint, written for a model to read and fix. */
export interface Issue {
  readonly severity: 'error' | 'warning';
  /** Id-based path as written in the file, e.g. `limbs[id=hindleg].attach.at`; "" is the root. */
  readonly path: string;
  /** Stable machine-readable code, e.g. `unknown_key`, `out_of_range`, `unknown_reference`. */
  readonly code: string;
  /** What is wrong, e.g. `1.4 is outside 0–1`. */
  readonly message: string;
  /** The valid range or values, when there are any. */
  readonly expected?: string;
  /** A concrete suggested fix, e.g. `did you mean "length"?`. */
  readonly fix?: string;
}

export type PathKey = string | number;

/** One-line rendering: `path: message (expected …) — fix`. */
export function formatIssue(issue: Issue): string {
  const where = issue.path === '' ? '(root)' : issue.path;
  const expected =
    issue.expected === undefined || issue.message.includes(issue.expected)
      ? ''
      : ` (expected ${issue.expected})`;
  const fix = issue.fix === undefined ? '' : ` — ${issue.fix}`;
  return `${where}: ${issue.message}${expected}${fix}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Renders a path against the document it points into, addressing list items by id so paths stay
 * stable when lists merge or mirror: ['limbs', 1, 'attach', 'at'] → `limbs[id=hindleg].attach.at`.
 * Items without an id fall back to `[n]`, or to `indexOf(item)` when given (e.g. the user's own
 * index for an item that merging moved).
 */
export function formatPath(
  path: readonly PathKey[],
  doc: unknown,
  indexOf?: (item: unknown) => number | undefined,
): string {
  let out = '';
  let node: unknown = doc;
  for (const key of path) {
    if (typeof key === 'number') {
      const item = Array.isArray(node) ? node[key] : undefined;
      const id = isRecord(item) && typeof item.id === 'string' ? item.id : undefined;
      out += id === undefined ? `[${indexOf?.(item) ?? key}]` : `[id=${id}]`;
      node = item;
    } else {
      out += out === '' ? key : `.${key}`;
      node = isRecord(node) ? node[key] : undefined;
    }
  }
  return out;
}

// --- Walking Zod schemas (to find allowed keys and bounds for an issue's path) ---------------

interface Def {
  type: string;
  innerType?: z.ZodType;
  shape?: Record<string, z.ZodType>;
  catchall?: z.ZodType;
  element?: z.ZodType;
  options?: z.ZodType[];
  valueType?: z.ZodType;
  in?: z.ZodType;
}

const defOf = (s: z.ZodType): Def => (s as unknown as { _zod: { def: Def } })._zod.def;

export function unwrap(schema: z.ZodType): z.ZodType {
  let s = schema;
  for (let i = 0; i < 16; i++) {
    const def = defOf(s);
    if (
      def.innerType &&
      ['optional', 'default', 'prefault', 'nullable', 'readonly', 'catch'].includes(def.type)
    ) {
      s = def.innerType;
    } else if (def.type === 'pipe' && def.in) {
      s = def.in;
    } else {
      break;
    }
  }
  return s;
}

function matchesShape(schema: z.ZodType, value: unknown): boolean {
  const t = defOf(unwrap(schema)).type;
  if (Array.isArray(value)) return t === 'array';
  if (isRecord(value)) return t === 'object' || t === 'record';
  if (value === null) return t === 'null';
  return typeof value === t || (t === 'enum' && typeof value === 'string') || t === 'literal';
}

/** The schema node for `key` inside `schema`, given the value found there. */
function childSchema(schema: z.ZodType, key: PathKey, value: unknown): z.ZodType | undefined {
  let s = unwrap(schema);
  let def = defOf(s);
  if (def.type === 'union' && def.options) {
    s = unwrap(def.options.find((o) => matchesShape(o, value)) ?? def.options[0] ?? s);
    def = defOf(s);
  }
  if (def.type === 'object') return def.shape?.[String(key)] ?? def.catchall;
  if (def.type === 'array') return def.element;
  if (def.type === 'record') return def.valueType;
  return undefined;
}

/** Walks `path` through both the schema and the input, returning the schema node and value there. */
export function locate(
  schema: z.ZodType,
  root: unknown,
  path: readonly PathKey[],
): { schema: z.ZodType | undefined; value: unknown } {
  let s: z.ZodType | undefined = schema;
  let v: unknown = root;
  for (const key of path) {
    const next: unknown =
      Array.isArray(v) || isRecord(v) ? (v as Record<PathKey, unknown>)[key] : undefined;
    s = s === undefined ? undefined : childSchema(s, key, v);
    v = next;
  }
  return { schema: s, value: v };
}

/** Allowed keys of an object schema (undefined for open objects). */
export function objectKeys(schema: z.ZodType, value: unknown): string[] | undefined {
  let s = unwrap(schema);
  let def = defOf(s);
  if (def.type === 'union' && def.options) {
    s = unwrap(def.options.find((o) => matchesShape(o, value)) ?? s);
    def = defOf(s);
  }
  return def.type === 'object' && def.shape ? Object.keys(def.shape) : undefined;
}

function numberBounds(schema: z.ZodType | undefined): { min?: number; max?: number } {
  if (schema === undefined) return {};
  let s = unwrap(schema);
  const def = defOf(s);
  if (def.type === 'union' && def.options) {
    s = unwrap(def.options[0] ?? s);
  }
  if (defOf(s).type === 'array' && defOf(s).element) s = unwrap(defOf(s).element as z.ZodType);
  const n = s as unknown as { minValue?: number | null; maxValue?: number | null };
  return {
    ...(typeof n.minValue === 'number' && Number.isFinite(n.minValue) ? { min: n.minValue } : {}),
    ...(typeof n.maxValue === 'number' && Number.isFinite(n.maxValue) ? { max: n.maxValue } : {}),
  };
}

const describeValue = (v: unknown): string =>
  v === undefined
    ? 'nothing'
    : Array.isArray(v)
      ? 'a list'
      : v === null
        ? 'null'
        : typeof v === 'object'
          ? 'an object'
          : JSON.stringify(v);

const typeName = (v: unknown): string =>
  v === undefined
    ? 'nothing'
    : v === null
      ? 'null'
      : Array.isArray(v)
        ? 'list'
        : typeof v === 'object'
          ? 'object'
          : typeof v;

const quoteList = (values: readonly unknown[]) => values.map((v) => JSON.stringify(v)).join(', ');

interface RawIssue {
  code: string;
  path: PropertyKey[];
  message: string;
  keys?: string[];
  values?: unknown[];
  expected?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  errors?: RawIssue[][];
  format?: string;
  pattern?: string;
}

/**
 * Converts Zod issues into blueprint issues with id-based paths, ranges and suggested fixes.
 * `schema` and `input` are what was parsed; `prefix` places a sub-document (e.g. a part's params)
 * inside the blueprint.
 */
export function fromZodIssues(
  rawIssues: readonly unknown[],
  schema: z.ZodType,
  input: unknown,
  pathString: (path: readonly PathKey[]) => string,
): Issue[] {
  const out: Issue[] = [];
  for (const raw of rawIssues as RawIssue[]) {
    const path = raw.path.map((k) => (typeof k === 'number' ? k : String(k)));
    const at = locate(schema, input, path);
    const issue = convert(raw, path, at, schema, input, pathString);
    out.push(...issue);
  }
  return out;
}

function convert(
  raw: RawIssue,
  path: PathKey[],
  at: { schema: z.ZodType | undefined; value: unknown },
  schema: z.ZodType,
  input: unknown,
  pathString: (path: readonly PathKey[]) => string,
): Issue[] {
  const p = pathString(path);
  const err = (code: string, message: string, extra: Partial<Issue> = {}): Issue => ({
    severity: 'error',
    path: p,
    code,
    message,
    ...extra,
  });

  switch (raw.code) {
    case 'unrecognized_keys': {
      const known = at.schema ? (objectKeys(at.schema, at.value) ?? []) : [];
      return (raw.keys ?? []).map((key) => {
        const where = path.filter((k) => typeof k === 'string').join('.');
        const scoped = Object.keys(HINTS)
          .filter((h) => h.startsWith(`${where}.`))
          .map((h) => h.slice(where.length + 1));
        const hintKey = HINTS[`${where}.${key}`] !== undefined ? key : didYouMean(key, scoped);
        const hint =
          (hintKey !== undefined ? HINTS[`${where}.${hintKey}`] : undefined) ?? HINTS[key];
        const guess = hint === undefined ? didYouMean(key, known) : undefined;
        return {
          severity: 'error' as const,
          path: pathString([...path, key]),
          code: 'unknown_key',
          message: `unknown key "${key}"`,
          expected: known.length > 0 ? `one of ${quoteList(known)}` : undefined,
          fix: hint ?? (guess ? `did you mean "${guess}"?` : 'remove it'),
        };
      });
    }
    case 'too_small':
    case 'too_big': {
      if (raw.origin === 'array' || raw.origin === 'string') {
        const n = raw.code === 'too_small' ? raw.minimum : raw.maximum;
        const unit = raw.origin === 'array' ? 'items' : 'characters';
        return [
          err(
            'bad_length',
            `${raw.code === 'too_small' ? 'needs at least' : 'allows at most'} ${n} ${unit}`,
          ),
        ];
      }
      const bounds = numberBounds(at.schema);
      const min = bounds.min ?? (raw.code === 'too_small' ? Number(raw.minimum) : undefined);
      const max = bounds.max ?? (raw.code === 'too_big' ? Number(raw.maximum) : undefined);
      const value = at.value;
      const expected =
        min !== undefined && max !== undefined
          ? `${min}–${max}`
          : min !== undefined
            ? `≥ ${min}`
            : `≤ ${max}`;
      const clamp = raw.code === 'too_small' ? min : max;
      return [
        err('out_of_range', `${describeValue(value)} is outside ${expected}`, {
          expected,
          ...(clamp !== undefined ? { fix: `use a value in range, e.g. ${clamp}` } : {}),
        }),
      ];
    }
    case 'invalid_value': {
      const values = raw.values ?? [];
      const v = at.value;
      const guess = typeof v === 'string' ? didYouMean(v, values.map(String)) : undefined;
      const expected =
        values.length <= 24
          ? `one of ${quoteList(values)}`
          : `one of ${values.length} known values`;
      return [
        err('invalid_value', `${describeValue(v)} is not allowed`, {
          expected,
          fix: guess ? `did you mean "${guess}"?` : `pick one of ${quoteList(values.slice(0, 8))}`,
        }),
      ];
    }
    case 'invalid_type': {
      const v = at.value;
      if (v === undefined) {
        return [
          err('missing', 'is required', {
            expected: raw.expected,
            fix: `add ${p.split('.').at(-1)}`,
          }),
        ];
      }
      return [
        err('invalid_type', `expected ${raw.expected}, got ${typeName(v)}`, {
          expected: raw.expected,
        }),
      ];
    }
    case 'invalid_union': {
      // Report the branch that matches the value's shape (a number vs a list, a string vs an object).
      const v = at.value;
      const branches = raw.errors ?? [];
      const unionDef = at.schema ? defOf(unwrap(at.schema)) : undefined;
      const options = unionDef?.options ?? [];
      const index = options.findIndex((o) => matchesShape(o, v));
      const branch = index >= 0 ? branches[index] : undefined;
      if (branch && branch.length > 0) {
        return fromZodIssues(
          branch.map((b) => ({ ...b, path: [...path, ...b.path] })),
          schema,
          input,
          pathString,
        );
      }
      const shapes = options.map((o) => defOf(unwrap(o)).type).join(' or ');
      return [err('invalid_type', `expected ${shapes}, got ${typeName(v)}`, { expected: shapes })];
    }
    case 'invalid_format': {
      if (raw.format === 'regex') {
        return [
          err('invalid_id', `${describeValue(at.value)} is not a valid id`, {
            expected: 'lowercase letters, digits, "-" or "_", starting with a letter',
            fix:
              typeof at.value === 'string'
                ? `use "${
                    at.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]+/g, '-')
                      .replace(/^[^a-z]+/, '') || 'part'
                  }"`
                : undefined,
          }),
        ];
      }
      return [err('invalid_format', raw.message)];
    }
    case 'custom': {
      const v = at.value;
      const guess = typeof v === 'string' ? didYouMean(v, COLOR_NAMES) : undefined;
      return [
        err('invalid_value', `${describeValue(v)} is ${raw.message}`, {
          ...(raw.message === 'not a colour'
            ? {
                expected: '"#rrggbb", "#rgb" or a CSS colour name',
                fix: guess ? `did you mean "${guess}"?` : 'use a colour such as "#7a6a50"',
              }
            : {}),
        }),
      ];
    }
    default:
      return [err(raw.code, raw.message)];
  }
}
