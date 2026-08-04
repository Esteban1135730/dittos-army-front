import type { SentHomologUnit } from "../../utils/sent-unit-homolog";

export type SentUnitBlueprintGroup = {
  key: string;
  blueprintId: number | null;
  name: string;
  units: SentHomologUnit[];
};

function groupKey(u: SentHomologUnit): string {
  if (typeof u.blueprint_id === "number" && u.blueprint_id > 0) {
    return `bp:${u.blueprint_id}`;
  }
  const name = (u.name || "").trim().toLowerCase() || "sin-nombre";
  const lang = (u.language || "").trim().toLowerCase();
  const rareza = (u.rareza || "").trim().toLowerCase();
  return `name:${name}|${lang}|${rareza}`;
}

/** Unidad a enfocar al abrir el grupo: pendiente con match, luego pendiente, luego la primera. */
export function pickFocusSentUnit(
  units: SentHomologUnit[],
  hasPerfect?: (sentUnitKey: string) => boolean,
): SentHomologUnit | null {
  if (units.length === 0) return null;
  const pending = units.filter((u) => u.status === "pending");
  if (pending.length > 0) {
    if (hasPerfect) {
      const withMatch = pending.find((u) => hasPerfect(u.sent_unit_key));
      if (withMatch) return withMatch;
    }
    return pending[0] ?? null;
  }
  return units[0] ?? null;
}

/**
 * Agrupa unidades sent por blueprint CT (o nombre+idioma+rareza si no hay BP).
 * Orden por nombre; una sola imagen por grupo en UI.
 */
export function groupSentHomologUnitsByBlueprint(
  units: SentHomologUnit[],
): SentUnitBlueprintGroup[] {
  const map = new Map<string, SentHomologUnit[]>();
  for (const u of units) {
    const key = groupKey(u);
    const list = map.get(key) ?? [];
    list.push(u);
    map.set(key, list);
  }

  const groups: SentUnitBlueprintGroup[] = [...map.entries()].map(
    ([key, groupUnits]) => {
      const first = groupUnits[0];
      return {
        key,
        blueprintId:
          typeof first?.blueprint_id === "number" && first.blueprint_id > 0
            ? first.blueprint_id
            : null,
        name: first?.name?.trim() || first?.sent_unit_key || "Sin nombre",
        units: groupUnits,
      };
    },
  );

  groups.sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );
  return groups;
}
