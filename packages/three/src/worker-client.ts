import type { CompiledCreature, Quality } from '@spawnforge/core';

/** Messages between `createWorkerCompiler` and a compile worker (see `serveCompiles`). */
export interface CompileRequest {
  readonly id: number;
  readonly blueprint: unknown;
  readonly quality: Quality;
}
export type CompileReply =
  | {
      readonly id: number;
      readonly ok: true;
      readonly compiled: CompiledCreature;
      readonly ms: number;
    }
  | { readonly id: number; readonly ok: false; readonly error: string };

export interface WorkerCompiler {
  compile(
    blueprint: unknown,
    quality?: Quality,
  ): Promise<{ compiled: CompiledCreature; ms: number }>;
  terminate(): void;
}

/**
 * Compiles off the main thread. The worker script imports the packs it needs and calls
 * `serveCompiles` (from `@spawnforge/three/worker`), since module code cannot be sent to a worker.
 */
export function createWorkerCompiler(workers: readonly Worker[]): WorkerCompiler {
  let next = 0;
  let round = 0;
  const pending = new Map<
    number,
    { resolve: (v: { compiled: CompiledCreature; ms: number }) => void; reject: (e: Error) => void }
  >();
  for (const worker of workers) {
    worker.onmessage = (event: MessageEvent<CompileReply>) => {
      const reply = event.data;
      const job = pending.get(reply.id);
      if (!job) return;
      pending.delete(reply.id);
      if (reply.ok) job.resolve({ compiled: reply.compiled, ms: reply.ms });
      else job.reject(new Error(reply.error));
    };
  }
  return {
    compile(blueprint, quality = 'medium') {
      const id = next++;
      const worker = workers[round++ % workers.length] as Worker;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, blueprint, quality } satisfies CompileRequest);
      });
    },
    terminate() {
      for (const w of workers) w.terminate();
      for (const job of pending.values()) job.reject(new Error('compiler terminated'));
      pending.clear();
    },
  };
}
