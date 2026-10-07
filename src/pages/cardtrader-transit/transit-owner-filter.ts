import axios from "axios";
import { getApiTcgHeader } from "../../config/api";
import { isOwnerKey, ownersForTcg, type OwnerKey } from "../../config/owners";
import {
  API_CARDTRADER_TRANSIT_LOTS,
  type CardtraderTransitCatalogLine,
  type CardtraderTransitLotRow,
} from "./cardtrader-transit-types";

/** Filtro de dueño en tránsito CT (Pokémon: Pablo / Esteban). */
export type TransitOwnerFilter = "all" | OwnerKey;

export function transitOwnerFilterOptions(): Array<{
  value: TransitOwnerFilter;
  label: string;
}> {
  const tcg = getApiTcgHeader();
  const owners = ownersForTcg(tcg);
  return [
    { value: "all", label: "Todos" },
    ...owners.map((o) => ({ value: o.key as OwnerKey, label: o.label })),
  ];
}

export function pokemonOwnerKeysForTransit(): OwnerKey[] {
  return ownersForTcg(getApiTcgHeader()).map((o) => o.key);
}

function ownersForFilter(filter: TransitOwnerFilter): OwnerKey[] {
  if (filter !== "all") {
    return isOwnerKey(filter) ? [filter] : pokemonOwnerKeysForTransit();
  }
  return pokemonOwnerKeysForTransit();
}

export async function fetchOpenTransitLots(
  filter: TransitOwnerFilter,
): Promise<CardtraderTransitLotRow[]> {
  const owners = ownersForFilter(filter);
  const chunks = await Promise.all(
    owners.map(async (owner) => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/open`, {
        ownerOverride: owner,
      });
      const rows = Array.isArray(res.data)
        ? (res.data as CardtraderTransitLotRow[])
        : [];
      return rows.map((row) => ({
        ...row,
        owner: isOwnerKey(row.owner) ? row.owner : owner,
      }));
    }),
  );
  return chunks
    .flat()
    .sort(
      (a, b) =>
        new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime(),
    );
}

export async function fetchOpenTransitCatalog(
  filter: TransitOwnerFilter,
): Promise<CardtraderTransitCatalogLine[]> {
  const owners = ownersForFilter(filter);
  const chunks = await Promise.all(
    owners.map(async (owner) => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/open/catalog`, {
        ownerOverride: owner,
      });
      const rows = Array.isArray(res.data)
        ? (res.data as CardtraderTransitCatalogLine[])
        : [];
      return rows.map((row) => ({
        ...row,
        owner: isOwnerKey(row.owner) ? row.owner : owner,
      }));
    }),
  );
  return chunks.flat();
}

export function parseTransitLotOwnerFromSearch(
  raw: string | null,
): OwnerKey | undefined {
  if (!raw?.trim()) return undefined;
  const key = raw.trim().toLowerCase();
  return isOwnerKey(key) ? key : undefined;
}
