/** Concurrencia por defecto para lotes de peticiones HTTP independientes desde el panel. */
export const DEFAULT_REQUEST_CONCURRENCY = 6;

/**
 * Como `Promise.all(items.map(fn))` pero con como mucho `concurrency` tareas en vuelo.
 * El resultado conserva el orden de `items`. Si una tarea rechaza, la promesa rechaza
 * con ese error y no se arrancan tareas nuevas (las ya en vuelo terminan solas).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = DEFAULT_REQUEST_CONCURRENCY,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;
  const limit = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  let next = 0;
  let failed = false;

  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/**
 * Variante que nunca rechaza: cada posición es `{ ok: true, value }` o `{ ok: false, error }`,
 * en el mismo orden que `items`. Útil cuando cada ítem reporta su propio error.
 */
export async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = DEFAULT_REQUEST_CONCURRENCY,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  return mapWithConcurrency(
    items,
    async (item, index) => {
      try {
        return { ok: true as const, value: await fn(item, index) };
      } catch (error) {
        return { ok: false as const, error };
      }
    },
    concurrency,
  );
}
