/** Comparación laxa entre nombre del cliente del panel y «A nombre de» del mensaje. */
export function clientNameDiffersFromMessage(
  clientNombre: string,
  messageName: string | null | undefined,
): boolean {
  const a = clientNombre.trim().toLowerCase();
  const b = (messageName ?? "").trim().toLowerCase();
  if (!b) return false;
  return a !== b;
}
