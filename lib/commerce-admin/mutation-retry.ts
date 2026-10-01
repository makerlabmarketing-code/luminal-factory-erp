/** Retain an operation ID until the caller receives a confirmed success. */
export function createCommerceMutationRetry() {
  let pending: { fingerprint: string; operationId: string } | null = null;

  return {
    prepare(path: string, method: string, body: unknown): string {
      const fingerprint = JSON.stringify([path, method, body]);
      if (pending?.fingerprint !== fingerprint) {
        pending = { fingerprint, operationId: crypto.randomUUID() };
      }
      return pending.operationId;
    },
    confirm(operationId: string): void {
      if (pending?.operationId === operationId) pending = null;
    },
  };
}
