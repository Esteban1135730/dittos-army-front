import type { OwnerKey } from "../../config/owners";
import { isOwnerKey } from "../../config/owners";
import type { PanelHomologItem, SentHomologUnit } from "../../utils/sent-unit-homolog";

function ownerOfItem(item: PanelHomologItem | undefined): OwnerKey {
  return isOwnerKey(item?.owner) ? item.owner : "pablo";
}

function sentMatchesPanelItem(
  unit: Pick<SentHomologUnit, "product_id" | "blueprint_id">,
  item: PanelHomologItem,
): boolean {
  const uPid =
    typeof unit.product_id === "number" && unit.product_id > 0
      ? unit.product_id
      : null;
  const iPid =
    typeof item.product_id === "number" && item.product_id > 0
      ? item.product_id
      : null;
  if (uPid != null && uPid === iPid) return true;
  const uBp =
    typeof unit.blueprint_id === "number" && unit.blueprint_id > 0
      ? unit.blueprint_id
      : null;
  const iBp =
    typeof item.blueprint_id === "number" && item.blueprint_id > 0
      ? item.blueprint_id
      : null;
  return uBp != null && uBp === iBp;
}

/**
 * Unidades de este envío CT que corresponden al dueño del lote de tránsito.
 * 1) Ya homologadas a una línea/lote de ese dueño.
 * 2) Pendientes que calzan product/blueprint, hasta el cupo disponible del lote.
 */
export function filterSentUnitsByOwner(
  units: SentHomologUnit[],
  panelItems: PanelHomologItem[],
  owner: OwnerKey,
): SentHomologUnit[] {
  const itemsByLine = new Map(panelItems.map((p) => [p.transit_line_id, p]));
  const itemsByLot = new Map<string, PanelHomologItem[]>();
  for (const p of panelItems) {
    const list = itemsByLot.get(p.transit_lot_id) ?? [];
    list.push(p);
    itemsByLot.set(p.transit_lot_id, list);
  }

  const claimed = new Set<string>();
  const out: SentHomologUnit[] = [];

  const linkedOwner = (u: SentHomologUnit): OwnerKey | null => {
    if (u.transit_line_id) {
      const item = itemsByLine.get(u.transit_line_id);
      if (item) return ownerOfItem(item);
    }
    if (u.transit_lot_id) {
      const lotItems = itemsByLot.get(u.transit_lot_id);
      if (lotItems?.[0]) return ownerOfItem(lotItems[0]);
    }
    return null;
  };

  for (const u of units) {
    if (linkedOwner(u) === owner) {
      out.push(u);
      claimed.add(u.sent_unit_key);
    }
  }

  for (const item of panelItems) {
    if (ownerOfItem(item) !== owner) continue;
    let slots = Math.max(0, item.available_in_session);
    if (slots <= 0) continue;
    for (const u of units) {
      if (slots <= 0) break;
      if (claimed.has(u.sent_unit_key)) continue;
      if (u.status !== "pending") continue;
      if (!sentMatchesPanelItem(u, item)) continue;
      out.push(u);
      claimed.add(u.sent_unit_key);
      slots -= 1;
    }
  }

  return out;
}
