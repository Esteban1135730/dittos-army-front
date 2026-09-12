/** Extrae «A nombre de:» del mensaje de carrito (misma regla que el back). */
export function extractClientNameFromStoreMessage(
  message: string,
): string | null {
  const m = message.match(/A nombre de:\s*(.+?)(?:\r?\n|$)/i);
  if (!m) return null;
  return m[1].trim() || null;
}

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
