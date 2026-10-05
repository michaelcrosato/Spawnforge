import { type CatalogEntry, createRegistry, FORMAT, type Pack } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

/**
 * Command implementations as plain functions returning JSON-ready data. `bin.ts` prints them and
 * the MCP server wraps the same functions as tools, so the two never drift apart.
 */
export const DEFAULT_PACKS: readonly Pack[] = [basicPack];

export function listModules(packs: readonly Pack[] = DEFAULT_PACKS): {
  format: string;
  modules: CatalogEntry[];
} {
  return { format: FORMAT, modules: createRegistry(packs).catalog() };
}
