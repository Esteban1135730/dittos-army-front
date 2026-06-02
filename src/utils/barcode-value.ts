/** Resultado normalizado de un código de barras o QR escaneado. */
export type BarcodeScanValue = {
  /** Texto tal como lo devolvió el lector. */
  raw: string;
  /** Identificador listo para usar (recortado; mismo contenido si ya es id). */
  id: string;
};

/**
 * Normaliza el texto escaneado a un id numérico o alfanumérico utilizable.
 */
export function parseBarcodeScan(text: string): BarcodeScanValue {
  const raw = text.trim();
  if (!raw) {
    return { raw: "", id: "" };
  }
  return { raw, id: raw };
}

export function isBarcodeIdLike(id: string): boolean {
  if (!id) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._\-:/]*$/.test(id) || /^\d+$/.test(id);
}
