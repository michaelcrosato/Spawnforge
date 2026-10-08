/**
 * The gallery (docs/design/12.2-gallery.md): curated creatures on one static site. The index
 * shows them as cards in three groups; a creature's page has its render, a live viewer, its
 * blueprint, a `.glb` download and a link that opens it in the sandbox. Pages are hash routes
 * (`#/example/grey-wolf`), so the built site works from any folder on any static host.
 */
import { createRegistry } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { createWorkerCompiler } from '@spawnforge/three';
import { byId, type Entry, entries, type Group } from './entries.ts';
import { createThumbnails, type Thumbnails } from './thumbs.ts';
import { createViewer, type Viewer } from './viewer.ts';

const registry = createRegistry([basicPack]);
const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
/** The sandbox to open creatures in: set at build time, the dev server's by default. */
const SANDBOX =
  (import.meta.env.VITE_SANDBOX_URL as string | undefined) ?? 'http://localhost:5173/';

const GROUPS: Record<Group, { title: string; about: string }> = {
  example: {
    title: 'Examples',
    about: 'The blueprints in examples/, each beside its contact sheet: the golden test set.',
  },
  theme: {
    title: 'Themes',
    about: 'Every theme at six seeds, as `spawnforge generate` makes them.',
  },
  eval: {
    title: 'Written by agents',
    about:
      'Creatures an agent wrote from a one-line prompt, with only the docs and the command line (the gate 9 prompt suites).',
  },
};

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

const compiler = createWorkerCompiler(
  Array.from(
    { length: Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1)) },
    () => new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' }),
  ),
);
let thumbnails: Promise<Thumbnails> | undefined;
let viewer: Viewer | undefined;

function showIndex(filter: Group | 'all') {
  const groups = (Object.keys(GROUPS) as Group[]).filter((g) => filter === 'all' || g === filter);
  thumbnails ??= createThumbnails(compiler, registry);
  const cards: { img: HTMLImageElement; entry: Entry }[] = [];
  app.replaceChildren(
    el(
      'nav',
      { className: 'filters' },
      ...(['all', ...Object.keys(GROUPS)] as const).map((g) =>
        el(
          'a',
          { href: g === 'all' ? '#/' : `#/${g}`, className: g === filter ? 'active' : '' },
          g === 'all' ? 'All' : GROUPS[g as Group].title,
        ),
      ),
    ),
    ...groups.map((group) => {
      const items = entries.filter((e) => e.group === group);
      return el(
        'section',
        { className: 'group' },
        el('h2', {}, `${GROUPS[group].title} `, el('small', {}, String(items.length))),
        el('p', { className: 'about' }, GROUPS[group].about),
        el(
          'div',
          { className: 'cards' },
          ...items.map((entry) => {
            // Its name as its alt text once drawn: until then the label below says it.
            const img = el('img', { alt: '', width: '256', height: '256' });
            img.dataset.name = entry.name;
            cards.push({ img, entry });
            const card = el(
              'a',
              { className: 'card', href: `#/${entry.id}` },
              img,
              el('span', { className: 'name' }, entry.name),
            );
            card.dataset.id = entry.id;
            return card;
          }),
        ),
      );
    }),
  );
  void thumbnails.then((t) => {
    for (const { img, entry } of cards) t.watch(img, entry.blueprint);
  });
}

/** A base64url of the blueprint, for the sandbox link (`#blueprint=`). */
const encode = (json: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(json))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function showCreature(entry: Entry) {
  const blueprint = await entry.blueprint();
  const file = entry.id.split('/').at(-1) ?? 'creature';
  const json = `${JSON.stringify(blueprint, null, 2)}\n`;
  const canvas = el('canvas', { className: 'viewer' });
  const actions = el('div', { className: 'actions' });
  const glbButton = el('button', { type: 'button', className: 'glb' }, 'Download .glb');
  const status = el('span', { className: 'status' });
  const blueprintLink = el(
    'a',
    {
      className: 'download blueprint',
      download: `${file}.json`,
      href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
    },
    'Download blueprint',
  );
  const sandboxLink = el(
    'a',
    {
      className: 'sandbox',
      href: `${SANDBOX}?creature=${encodeURIComponent(file)}#blueprint=${encode(blueprint)}`,
      target: '_blank',
      rel: 'noopener',
    },
    'Open in sandbox',
  );
  app.replaceChildren(
    el('p', {}, el('a', { href: `#/${entry.group}` }, `← ${GROUPS[entry.group].title}`)),
    el('h1', {}, entry.name),
    el('p', { className: 'note' }, entry.note),
    el('div', { className: 'stage' }, canvas, actions),
    el('div', { className: 'links' }, blueprintLink, glbButton, sandboxLink, status),
    ...(entry.sheet
      ? [el('img', { className: 'sheet', src: entry.sheet, alt: `${entry.name}, six views` })]
      : []),
    el('details', {}, el('summary', {}, 'Blueprint'), el('pre', {}, json)),
  );
  const { compiled } = await compiler.compile(blueprint, 'medium');
  if (!canvas.isConnected) return;
  viewer = await createViewer(canvas, compiled, registry);
  actions.replaceChildren(
    ...viewer.actions.map((id) => {
      const button = el('button', { type: 'button' }, id);
      button.addEventListener('click', () => viewer?.act(id));
      return button;
    }),
  );
  canvas.dataset.ready = 'true';
  glbButton.addEventListener('click', async () => {
    glbButton.disabled = true;
    status.textContent = 'Baking texture maps…';
    try {
      // The exporter and the bake load on the first download.
      const { downloadGlb } = await import('./glb.ts');
      const { bytes, clips } = await downloadGlb(blueprint, registry, `${file}.glb`);
      status.textContent = `${file}.glb: ${Math.round(bytes / 1024)} KB, ${clips} clips`;
    } catch (error) {
      status.textContent = `Export failed: ${(error as Error).message}`;
    } finally {
      glbButton.disabled = false;
    }
  });
}

function route() {
  viewer?.dispose();
  viewer = undefined;
  const path = location.hash.replace(/^#\/?/, '');
  const entry = byId.get(path);
  if (entry) void showCreature(entry);
  else showIndex(path in GROUPS ? (path as Group) : 'all');
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
