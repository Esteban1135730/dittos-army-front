import { ESTEBAN_STOCK_MARK, type OwnerKey } from "../../config/owners";

/** Resumen de owners de una línea WhatsApp, p. ej. `1 Pablo + 1 ☼ Esteban`. */
export function formatWhatsAppLineOwners(
  owners: OwnerKey[] | undefined,
  mark: string = ESTEBAN_STOCK_MARK,
): string {
  if (!owners?.length) return "";
  const pablo = owners.filter((o) => o === "pablo").length;
  const esteban = owners.filter((o) => o === "esteban").length;
  const parts: string[] = [];
  if (pablo > 0) parts.push(`${pablo} Pablo`);
  if (esteban > 0) parts.push(`${esteban} ${mark} Esteban`);
  return parts.join(" + ");
}
