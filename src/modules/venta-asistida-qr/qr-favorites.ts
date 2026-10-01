import { isOwnerKey, type OwnerKey } from "../../config/owners";

export const QR_FAVORITES_STORAGE_KEY = "da-venta-qr-favorites";
export const QR_FAVORITES_MAX = 24;

export type QrFavorite = {
  stock_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  rareza: string | null;
  owner: OwnerKey;
};

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function qrFavoriteKey(
  item: Pick<QrFavorite, "owner" | "card_id" | "language" | "rareza">,
): string {
  const lang = (item.language ?? "").trim().toUpperCase();
  const rareza = (item.rareza ?? "").trim();
  return `${item.owner}|${item.card_id}|${lang}|${rareza}`;
}

export function isQrFavorite(
  list: QrFavorite[],
  item: Pick<QrFavorite, "owner" | "card_id" | "language" | "rareza">,
): boolean {
  const key = qrFavoriteKey(item);
  return list.some((fav) => qrFavoriteKey(fav) === key);
}

export function parseQrFavorites(raw: string | null): QrFavorite[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: QrFavorite[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const stock_id = String(row.stock_id ?? "").trim();
    const card_id = String(row.card_id ?? "").trim();
    if (!stock_id || !card_id || !isOwnerKey(row.owner)) continue;
    out.push({
      stock_id,
      card_id,
      card_name: String(row.card_name ?? ""),
      image_url: String(row.image_url ?? ""),
      language: String(row.language ?? ""),
      rareza:
        row.rareza == null || String(row.rareza).trim() === ""
          ? null
          : String(row.rareza),
      owner: row.owner,
    });
    if (out.length >= QR_FAVORITES_MAX) break;
  }
  return out;
}

export function toggleQrFavorite(
  list: QrFavorite[],
  next: QrFavorite,
): QrFavorite[] {
  const key = qrFavoriteKey(next);
  if (list.some((fav) => qrFavoriteKey(fav) === key)) {
    return list.filter((fav) => qrFavoriteKey(fav) !== key);
  }
  return [next, ...list.filter((fav) => qrFavoriteKey(fav) !== key)].slice(
    0,
    QR_FAVORITES_MAX,
  );
}

function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadQrFavorites(storage?: KeyValueStorage | null): QrFavorite[] {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return [];
  return parseQrFavorites(store.getItem(QR_FAVORITES_STORAGE_KEY));
}

export function saveQrFavorites(
  list: QrFavorite[],
  storage?: KeyValueStorage | null,
): void {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return;
  try {
    store.setItem(
      QR_FAVORITES_STORAGE_KEY,
      JSON.stringify(list.slice(0, QR_FAVORITES_MAX)),
    );
  } catch {
    // Cuota llena: el mostrador sigue; los favoritos viven solo en memoria.
  }
}
