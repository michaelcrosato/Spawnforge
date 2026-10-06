/**
 * Feature checks for suite B: each prompt lists what a faithful blueprint must contain, checked on
 * the creature it resolves to (presets merged, defaults filled, mirrored pairs expanded), so a
 * pair of wings counts as two wing limbs however it was written.
 *
 *   { "what": "limbs", "where": { "role": "wing" }, "min": 2, "says": "a pair of wings" }
 *   { "what": "parts", "where": { "type": "fin.*" }, "min": 1 }
 *   { "what": "field", "path": "body.neck.count", "min": 3 }
 *
 * `what` is `limbs`, `parts`, `layers` or `field`. `where` matches item fields by dotted path
 * (`foot.type`); a string with `*` matches as a glob, and a list matches any of its values.
 * Counts need `min` (default 1) and may set `max`; fields compare with `min`, `max`, `equals` or
 * `oneOf`.
 */
export interface Expect {
  readonly what: 'limbs' | 'parts' | 'layers' | 'field';
  readonly where?: Readonly<Record<string, unknown>>;
  readonly path?: string;
  readonly min?: number;
  readonly max?: number;
  readonly equals?: unknown;
  readonly oneOf?: readonly unknown[];
  /** What the check means, in words, for the score table. */
  readonly says?: string;
}

const get = (value: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined,
      value,
    );

function matches(actual: unknown, wanted: unknown): boolean {
  if (Array.isArray(wanted)) return wanted.some((w) => matches(actual, w));
  if (typeof wanted === 'string' && wanted.includes('*') && typeof actual === 'string') {
    const pattern = wanted.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`).test(actual);
  }
  return JSON.stringify(actual) === JSON.stringify(wanted);
}

/** The checks a creature fails, described in words. */
export function failedExpects(creature: unknown, expects: readonly Expect[]): string[] {
  const failed: string[] = [];
  for (const e of expects) {
    const label = e.says ?? JSON.stringify(e);
    if (e.what === 'field') {
      const value = get(creature, e.path ?? '');
      const ok =
        (e.min === undefined || (typeof value === 'number' && value >= e.min)) &&
        (e.max === undefined || (typeof value === 'number' && value <= e.max)) &&
        (e.equals === undefined || matches(value, e.equals)) &&
        (e.oneOf === undefined || matches(value, e.oneOf));
      if (!ok) failed.push(`${label} (${e.path} is ${JSON.stringify(value)})`);
      continue;
    }
    const list = get(creature, e.what === 'layers' ? 'skin.layers' : e.what);
    const items = Array.isArray(list) ? list : [];
    const count = items.filter((item) =>
      Object.entries(e.where ?? {}).every(([path, wanted]) => matches(get(item, path), wanted)),
    ).length;
    if (count < (e.min ?? 1) || (e.max !== undefined && count > e.max))
      failed.push(`${label} (found ${count})`);
  }
  return failed;
}
