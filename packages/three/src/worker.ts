import {
  compileCreature,
  compiledTransferables,
  createRegistry,
  type Pack,
  resolveBlueprint,
} from '@spawnforge/core';
import type { CompileReply, CompileRequest } from './worker-client.ts';

/** Call from a worker script with the packs it should know: handles compile requests. */
export function serveCompiles(packs: readonly Pack[]): void {
  const registry = createRegistry(packs);
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<CompileRequest>) => void) | null;
    postMessage(message: CompileReply, transfer: Transferable[]): void;
  };
  scope.onmessage = (event) => {
    const { id, blueprint, quality } = event.data;
    try {
      const t0 = performance.now();
      const compiled = compileCreature(resolveBlueprint(blueprint, registry), registry, {
        quality,
      });
      const ms = performance.now() - t0;
      scope.postMessage({ id, ok: true, compiled, ms }, compiledTransferables(compiled));
    } catch (error) {
      scope.postMessage(
        { id, ok: false, error: error instanceof Error ? error.message : String(error) },
        [],
      );
    }
  };
}
