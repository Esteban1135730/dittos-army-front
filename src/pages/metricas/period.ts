function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Default period: to = today local, from = same day 3 months earlier. */
export function defaultMetricsPeriod(now = new Date()): {
  from: string;
  to: string;
} {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to.getFullYear(), to.getMonth() - 3, to.getDate());
  return { from: toLocalYmd(from), to: toLocalYmd(to) };
}

export function cycleLabel(cycleKey: string, cycleClosedAt: string | null): string {
  if (cycleKey === "active" || !cycleClosedAt) return "Ciclo activo";
  try {
    const d = new Date(cycleClosedAt);
    return `Cerrado ${d.toLocaleString("es-CO")}`;
  } catch {
    return cycleClosedAt;
  }
}

export function productKindLabel(kind: string): string {
  if (kind === "unit") return "Unitario";
  if (kind === "quantity") return "Cantidad (bulk)";
  if (kind === "unknown") return "Desconocido";
  return kind;
}
