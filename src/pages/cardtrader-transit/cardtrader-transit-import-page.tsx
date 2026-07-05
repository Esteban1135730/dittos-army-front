import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../config/api";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import {
  type IncomingBatchBundleForCt0Draft,
  pricingFieldsFromOpenIncomingBatch,
} from "../../utils/ct0-incoming-batch-draft";
import Ct0IncomingRegisterPanel from "../test-cardtrader/ct0-incoming-register-panel";
import { API_INCOMING } from "../clientes/cliente-types";
import {
  API_CARDTRADER_TRANSIT_LOTS,
  type CardtraderTransitLotRow,
} from "./cardtrader-transit-types";

const API_CARDTRADER = apiUrl("/cardtrader");

export default function CardtraderTransitImportPage() {
  const boxQuery = useQuery<Ct0BoxItem[]>({
    queryKey: ["cardtrader", "ct0-box-items", "import"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/ct0-box-items`);
      return Array.isArray(res.data) ? (res.data as Ct0BoxItem[]) : [];
    },
  });

  const transitLotsQuery = useQuery<CardtraderTransitLotRow[]>({
    queryKey: ["cardtrader-transit-lots-open"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/open`);
      return Array.isArray(res.data) ? (res.data as CardtraderTransitLotRow[]) : [];
    },
  });

  const legacyOpenQuery = useQuery<
    {
      batch_id: string;
      purchase_date: string;
      total_cop_cards_cost?: number;
      total_eur_cards_cost?: number;
      cards_cost_currency?: string;
    }[]
  >({
    queryKey: ["incoming-batch-open-legacy-ref"],
    queryFn: async () => {
      const res = await axios.get(`${API_INCOMING}/batch/open`);
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60 * 1000,
  });

  const legacyBundlesQuery = useQuery<IncomingBatchBundleForCt0Draft[]>({
    queryKey: [
      "incoming-batch-bundles-legacy-ref",
      (legacyOpenQuery.data ?? []).map((b) => b.batch_id).join(","),
    ],
    enabled: (legacyOpenQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const batches = legacyOpenQuery.data ?? [];
      return Promise.all(
        batches.map(async (batch) => {
          const res = await axios.get(`${API_INCOMING}/batch/${batch.batch_id}/items`);
          const items = Array.isArray(res.data) ? res.data : [];
          return {
            batchId: batch.batch_id,
            purchaseDate: batch.purchase_date,
            ...pricingFieldsFromOpenIncomingBatch(batch),
            items: items.map(
              (it: {
                card_name: string;
                quantity_ordered: number;
                remaining_quantity: number;
                unit_cost_cop?: number;
                eur_unit_price?: number;
              }) => ({
                card_name: it.card_name,
                quantity_ordered: it.quantity_ordered,
                remaining_quantity: it.remaining_quantity,
                unit_cost_cop: it.unit_cost_cop,
                eur_unit_price: it.eur_unit_price,
              }),
            ),
          };
        }),
      );
    },
  });

  const existingTransitLots = useMemo(
    () =>
      (transitLotsQuery.data ?? [])
        .filter((lot) => lot.ct0_package_key)
        .map((lot) => ({
          ct0_package_key: lot.ct0_package_key as string,
          lot_id: lot.lot_id,
        })),
    [transitLotsQuery.data],
  );

  const loading =
    boxQuery.isLoading ||
    transitLotsQuery.isLoading ||
    legacyOpenQuery.isLoading ||
    ((legacyOpenQuery.data?.length ?? 0) > 0 && legacyBundlesQuery.isLoading);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Importar desde CT Zero</h1>
          <p className="text-sm text-gray-600 mt-1">
            Registra checkouts CT Zero con previsualización TCGdex. Revisa que cada carta tenga
            imagen en catálogo antes de confirmar.
          </p>
        </div>
        <Link to="/cardtrader-transit" className="text-blue-600 hover:underline font-medium">
          ← Lotes en tránsito
        </Link>
      </div>

      <Ct0IncomingRegisterPanel
        compact
        ct0Items={boxQuery.data ?? []}
        existingTransitLots={existingTransitLots}
        legacyIncomingBundles={legacyBundlesQuery.data ?? []}
        loading={loading}
      />
    </div>
  );
}
