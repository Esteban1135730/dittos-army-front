/** Filas de `GET /stock` en caché TanStack: array (páginas actuales) u objeto 044 roto. */
export function stockRowsFromQueryData<T extends { _id: string }>(
  data: unknown,
): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}
