/** Campos mínimos para agrupar líneas de recepción por carta. */
export type ReceiptLineGroupInput = {
  line_id: string;
  card_id: string;
  card_name: string;
  language: string;
  rareza: string | null;
  collector_number: string | null;
  expansion: string | null;
  quantity_expected: number;
  blueprint_id?: number | null;
};

export type ReceiptLineCardGroup<
  T extends ReceiptLineGroupInput = ReceiptLineGroupInput,
> = {
  /** Clave estable: blueprint_id · card_id · fallback nombre */
  key: string;
  title: string;
  subtitle: string;
  lines: T[];
};

function groupKey(line: ReceiptLineGroupInput): string {
  if (line.blueprint_id != null && line.blueprint_id > 0) {
    return `bp:${line.blueprint_id}`;
  }
  const cardId = line.card_id?.trim();
  if (cardId) return `card:${cardId}`;
  const name = (line.card_name || "sin-nombre").trim().toLowerCase();
  const lang = (line.language || "").trim().toLowerCase();
  const rareza = (line.rareza || "").trim().toLowerCase();
  return `name:${name}|${lang}|${rareza}`;
}

function groupTitle(lines: ReceiptLineGroupInput[]): string {
  const first = lines[0];
  return first?.card_name?.trim() || first?.card_id || "Sin nombre";
}

function groupSubtitle(lines: ReceiptLineGroupInput[]): string {
  const first = lines[0];
  if (!first) return "";
  const parts: string[] = [];
  if (first.expansion) parts.push(first.expansion);
  if (first.collector_number) parts.push(`#${first.collector_number}`);
  if (first.blueprint_id != null && first.blueprint_id > 0) {
    parts.push(`BP#${first.blueprint_id}`);
  }
  const qty = lines.reduce((s, l) => s + (l.quantity_expected || 0), 0);
  parts.push(`${lines.length} línea(s)`);
  parts.push(`${qty} ud. esp.`);
  return parts.join(" · ");
}

/**
 * Agrupa líneas de recepción por blueprint CT / card_id (misma carta entre lotes),
 * ordenado por nombre para búsqueda visual.
 */
export function groupReceiptLinesByCard<T extends ReceiptLineGroupInput>(
  lines: T[],
): ReceiptLineCardGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const line of lines) {
    const key = groupKey(line);
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }

  const groups: ReceiptLineCardGroup<T>[] = [...map.entries()].map(
    ([key, groupLines]) => ({
      key,
      title: groupTitle(groupLines),
      subtitle: groupSubtitle(groupLines),
      lines: groupLines,
    }),
  );

  groups.sort((a, b) =>
    a.title.localeCompare(b.title, "es", { sensitivity: "base" }),
  );
  return groups;
}

export function filterReceiptLineCardGroups<T extends ReceiptLineGroupInput>(
  groups: ReceiptLineCardGroup<T>[],
  query: string,
): ReceiptLineCardGroup<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter((g) => {
    if (g.title.toLowerCase().includes(q)) return true;
    if (g.subtitle.toLowerCase().includes(q)) return true;
    return g.lines.some((l) => {
      const hay = [
        l.card_name,
        l.card_id,
        l.expansion,
        l.collector_number,
        l.language,
        l.rareza,
        l.blueprint_id != null ? String(l.blueprint_id) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  });
}
