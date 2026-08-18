/**
 * Selección de pedidos a imprimir: todos en la primera carga;
 * después solo se auto-marcan clientes que acaban de aparecer.
 * Los que el operador desmarcó no se vuelven a marcar.
 */
export function mergePedidoSelection(
  prevSelected: ReadonlySet<string>,
  currentIds: readonly string[],
  previouslySeenIds: ReadonlySet<string> | null,
): { selected: Set<string>; seen: Set<string> } {
  const seen = new Set(currentIds);
  const selected = new Set(prevSelected);
  const isFirstLoad = previouslySeenIds === null;

  for (const id of currentIds) {
    if (isFirstLoad || !previouslySeenIds.has(id)) {
      selected.add(id);
    }
  }

  return { selected, seen };
}
