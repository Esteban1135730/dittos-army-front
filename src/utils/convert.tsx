export function formatCOP(value: any) {
  if (typeof value === "string") {
    // Limpiar la cadena para solo dígitos y puntos o comas (por si vienen con formato)
    const limpio = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    const num = Number(limpio);
    if (isNaN(num)) return value; // No es número válido
    value = num;
  } else if (typeof value !== "number") {
    return value; // No es ni string ni número
  }

  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
