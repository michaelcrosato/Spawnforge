/**
 * The gallery's theme creatures (apps/gallery, docs/design/12.2-gallery.md): every theme at
 * seeds 1 to 6, as `spawnforge generate --theme <theme> --seed <n>` makes them. Generating takes
 * a sixth of a second each, too slow for the page, so `pnpm generate` writes them.
 */
import { createRegistry, generate } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

export const GALLERY_SEEDS = 6;

export function renderGalleryThemes(): string {
  const registry = createRegistry([basicPack]);
  const creatures = registry.list('theme').flatMap((theme) =>
    Array.from({ length: GALLERY_SEEDS }, (_, i) => {
      const seed = i + 1;
      const result = generate({ theme: theme.id, seed }, registry);
      return result.ok ? [{ theme: theme.id, seed, blueprint: result.blueprint }] : [];
    }).flat(),
  );
  return `${JSON.stringify(creatures, null, 2)}\n`;
}
