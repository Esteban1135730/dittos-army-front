/**
 * Multi-owner config (034). Keep in sync with
 * `dittos-army-back/src/config/owners.config.ts`.
 *
 * Current owner DBs are Pokémon. This cluster cannot rename databases, so
 * the physical names stay `test` (Pablo) and `esteban` (Esteban).
 * Convention for NEW physical DBs: `{tcg}-{owner}` via `databaseNameFor`
 * (for example `magic-pablo`). Do not point these two owners at that
 * pattern until the data actually lives there.
 */

export type OwnerKey = "pablo" | "esteban";

/** TCG slug for path and DB naming (only `pokemon` wired today). */
export type TcgKey = "pokemon";

export type FeatureKey =
  | "inicio"
  | "agregar-stock"
  | "stock"
  | "ventas"
  | "venta-asistida-qr"
  | "propiedad"
  | "clientes"
  | "cotizar"
  | "cardtrader"
  | "incoming"
  | "export-tienda";

export type OwnerDefinition = {
  key: OwnerKey;
  label: string;
  /** TCG this owner connection serves (Pokémon today). */
  tcg: TcgKey;
  /** Physical Mongo DB name used by Mongoose. */
  dbName: string;
  /**
   * Previous physical name when `dbName` follows `{tcg}-{owner}`.
   * Undefined when still on the legacy name.
   */
  legacyDbName?: string;
  stockQrPrefix: string;
  allowedFeatures: FeatureKey[];
};

export type OwnersConfig = {
  defaultOwner: OwnerKey;
  owners: Record<OwnerKey, OwnerDefinition>;
};

const ALL_FEATURES: FeatureKey[] = [
  "inicio",
  "agregar-stock",
  "stock",
  "ventas",
  "venta-asistida-qr",
  "propiedad",
  "clientes",
  "cotizar",
  "cardtrader",
  "incoming",
  "export-tienda",
];

const ESTEBAN_FEATURES: FeatureKey[] = [
  "inicio",
  "agregar-stock",
  "stock",
  "ventas",
  "venta-asistida-qr",
  "propiedad",
  "clientes",
  "cotizar",
  "cardtrader",
];

/**
 * Convention for NEW TCG/owner databases: `{tcg}-{owner}`.
 * Pablo and Esteban stay on `test` and `esteban` (see OWNERS_CONFIG).
 */
export function databaseNameFor(tcg: string, owner: string): string {
  return `${tcg}-${owner}`;
}

/** Pokémon physical DB for Pablo. Data is in `test`, not `pokemon-pablo`. */
const PABLO_DB_NAME = "test";
/** Pokémon physical DB for Esteban. Data is in `esteban`, not `pokemon-esteban`. */
const ESTEBAN_DB_NAME = "esteban";

export const OWNERS_CONFIG: OwnersConfig = {
  defaultOwner: "pablo",
  owners: {
    pablo: {
      key: "pablo",
      label: "Pablo",
      tcg: "pokemon",
      dbName: PABLO_DB_NAME,
      stockQrPrefix: "DA-STOCK:",
      allowedFeatures: [...ALL_FEATURES],
    },
    esteban: {
      key: "esteban",
      label: "Esteban",
      tcg: "pokemon",
      dbName: ESTEBAN_DB_NAME,
      stockQrPrefix: "ESTEBAN-STOCK:",
      allowedFeatures: [...ESTEBAN_FEATURES],
    },
  },
};

export const OWNER_STORAGE_KEY = "dittos.panel.activeOwner";

/** Prefijo visual de líneas de stock Esteban (ticket térmico y catálogo). U+263C. */
export const ESTEBAN_STOCK_MARK = "☼";

export function isOwnerKey(value: unknown): value is OwnerKey {
  return value === "pablo" || value === "esteban";
}

/** The complementary owner (pablo ↔ esteban). */
export function otherOwner(owner: OwnerKey): OwnerKey {
  return owner === "pablo" ? "esteban" : "pablo";
}

export function getOwnerDefinition(key: OwnerKey): OwnerDefinition {
  return OWNERS_CONFIG.owners[key];
}

export function isFeatureAllowed(owner: OwnerKey, feature: FeatureKey): boolean {
  return OWNERS_CONFIG.owners[owner].allowedFeatures.includes(feature);
}

export function parseStoredOwner(raw: string | null): OwnerKey {
  if (isOwnerKey(raw)) return raw;
  return OWNERS_CONFIG.defaultOwner;
}
