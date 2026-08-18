import type { ClientItem } from "./cliente-types";

type IdLike = { _id?: string | null; id?: string | null } | null | undefined;

/** Id estable aunque el API devuelva `_id` o `id`. */
export function clientItemId(c: IdLike): string {
  if (!c) return "";
  const raw = c._id ?? c.id;
  return raw != null && String(raw).trim() ? String(raw) : "";
}

export function normalizeClientItem(raw: unknown): ClientItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const _id = clientItemId(o as IdLike);
  if (!_id) return null;
  return {
    _id,
    nombre: String(o.nombre ?? ""),
    tienda_entrega: o.tienda_entrega != null ? String(o.tienda_entrega) : undefined,
    celular: o.celular != null ? String(o.celular) : undefined,
    facebook_usuario:
      o.facebook_usuario != null ? String(o.facebook_usuario) : undefined,
    metodo_contacto: (o.metodo_contacto === "facebook" ? "facebook" : "whatsapp") as
      | "whatsapp"
      | "facebook",
    notas: o.notas != null ? String(o.notas) : undefined,
  };
}

export function normalizeClientList(raw: unknown): ClientItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeClientItem).filter((c): c is ClientItem => c != null);
}
