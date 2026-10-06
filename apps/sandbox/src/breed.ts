import { crossbreed, formatDiff, generate, mutate, type Registry } from '@spawnforge/core';

type Blueprint = Record<string, unknown>;

/** What the breed tab needs from the sandbox. */
export interface BreedHooks {
  /** The focused creature's name and blueprint. */
  current(): { name: string; blueprint: Blueprint } | undefined;
  /** Every creature's name, for the crossbreed partner list. */
  names(): string[];
  blueprintOf(name: string): Blueprint | undefined;
  /** Adds a creature (replacing one of the same name) and returns the name it got. */
  add(name: string, blueprint: Blueprint): string;
  /** Shows these creatures together on the course, the first one focused. */
  show(names: string[]): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props))
    (node as unknown as Record<string, string>)[key] = value;
  node.append(...children);
  return node;
}

/**
 * The breed tab: generate a creature from a theme, mutate the focused one (or a litter of five),
 * and crossbreed it with another. Results join the creature list like any other blueprint.
 */
export function createBreeder(registry: Registry, root: HTMLElement, hooks: BreedHooks): void {
  const theme = el(
    'select',
    { ariaLabel: 'Theme' },
    ...registry.ids('theme').map((id) => new Option(id, id)),
  );
  const seed = el('input', { type: 'number', value: '1', min: '0', ariaLabel: 'Seed' });
  const amount = el('input', { type: 'range', min: '0', max: '100', value: '30' });
  const mix = el('input', { type: 'range', min: '0', max: '100', value: '50' });
  const partner = el('select', { ariaLabel: 'Partner' });
  const result = el('div', { className: 'breed-result' });
  let mutation = 0;

  const report = (text: string, diff: readonly string[] = []) => {
    result.replaceChildren(
      el('strong', {}, text),
      ...diff.slice(0, 12).map((line) => el('div', {}, line)),
      ...(diff.length > 12 ? [el('div', {}, `… ${diff.length - 12} more`)] : []),
    );
  };
  const nextSeed = () => {
    const n = Number(seed.value) || 0;
    seed.value = String(n + 1);
    return n;
  };

  const generateButton = el('button', { type: 'button', textContent: 'generate' });
  generateButton.addEventListener('click', () => {
    const made = generate({ theme: theme.value, seed: nextSeed() }, registry);
    if (!made.ok) return report(made.errors[0]?.message ?? 'could not generate');
    const name = hooks.add(String(made.blueprint.name ?? theme.value), made.blueprint);
    report(`${name}: a ${theme.value} ${String(made.blueprint.extends)}`);
    hooks.show([name]);
  });

  const child = (parent: { name: string; blueprint: Blueprint }, n: number) =>
    mutate(parent.blueprint, { seed: n, amount: Number(amount.value) / 100 }, registry);

  const mutateButton = el('button', { type: 'button', textContent: 'mutate' });
  mutateButton.addEventListener('click', () => {
    const parent = hooks.current();
    if (!parent) return;
    const made = child(parent, ++mutation);
    if (!made.ok) return report(made.errors[0]?.message ?? 'could not mutate');
    const name = hooks.add(`${parent.name} m${mutation}`, made.blueprint);
    report(`${name}: ${made.diff.length} genes changed`, formatDiff(made.diff));
    hooks.show([name]);
  });

  const litterButton = el('button', { type: 'button', textContent: 'litter of 5' });
  litterButton.addEventListener('click', () => {
    const parent = hooks.current();
    if (!parent) return;
    const names = [parent.name];
    for (let i = 0; i < 5; i++) {
      const made = child(parent, ++mutation);
      if (made.ok) names.push(hooks.add(`${parent.name} m${mutation}`, made.blueprint));
    }
    report(`${parent.name} and ${names.length - 1} mutants`);
    hooks.show(names);
  });

  const crossButton = el('button', { type: 'button', textContent: 'crossbreed' });
  crossButton.addEventListener('click', () => {
    const a = hooks.current();
    const b = hooks.blueprintOf(partner.value);
    if (!a || !b) return;
    const made = crossbreed(
      a.blueprint,
      b,
      { seed: nextSeed(), mix: Number(mix.value) / 100 },
      registry,
    );
    if (!made.ok) return report(made.errors[0]?.message ?? 'could not crossbreed');
    const name = hooks.add(`${a.name} × ${partner.value}`, made.blueprint);
    report(
      `${name}: built on ${made.base === 'a' ? a.name : partner.value}`,
      formatDiff(made.diff),
    );
    hooks.show([name, a.name, partner.value].filter((n, i, all) => all.indexOf(n) === i));
  });

  /** Refreshes the partner list (call when creatures are added or removed). */
  const refresh = () => {
    const current = partner.value;
    partner.replaceChildren(...hooks.names().map((name) => new Option(name, name)));
    if (hooks.names().includes(current)) partner.value = current;
  };
  root.addEventListener('focusin', refresh);
  refresh();

  root.replaceChildren(
    el('p', {}, 'New creatures join the creature list; save one from the JSON tab to keep it.'),
    el('div', { className: 'breed-row' }, theme, seed, generateButton),
    el('label', { className: 'breed-row' }, 'drift ', amount),
    el('div', { className: 'breed-row' }, mutateButton, litterButton),
    el('label', { className: 'breed-row' }, 'with ', partner),
    el('label', { className: 'breed-row' }, 'mix ', mix),
    el('div', { className: 'breed-row' }, crossButton),
    result,
  );
}
