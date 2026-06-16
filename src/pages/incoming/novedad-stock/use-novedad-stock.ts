import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiUrl } from '../../../config/api';

const API = apiUrl('/incoming/homolog/novedad-stock');

export type NovedadStockRow = {
  id: string;
  session_id: string;
  sent_unit_key: string;
  stock_id: string | null;
  card_name: string;
  card_id: string;
  expansion: string;
  language: string;
  blueprint_id: number;
  rareza: string | null;
  order_code: string;
  purchase_price_fx: number | null;
  price_currency: string;
  unit_cost_cop: number | null;
  novedad_notes: string;
  image_url: string;
  status: 'pending' | 'in_stock' | 'resolved';
  created_at?: string;
  stock_created_at?: string | null;
  resolved_at?: string | null;
};

export type NovedadStockPreviewItem = {
  tracking_id: string;
  sent_unit_key: string;
  card_name: string;
  card_id: string;
  language: string;
  image_url: string;
  expansion: string;
  quantity: number;
  purchase_price_fx: number | null;
  price_currency: string;
  unit_cost_cop: number;
  novedad_notes: string;
  errors: string[];
};

export type NovedadStockPreviewResponse = {
  session_id: string;
  summary: {
    total_cards: number;
    total_cop: number;
    error_count: number;
    ok_count: number;
  };
  items: NovedadStockPreviewItem[];
};

function axiosMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
  }
  return 'Error en la operación.';
}

export function useNovedadStockList() {
  return useQuery<NovedadStockRow[]>({
    queryKey: ['homolog-novedad-stock'],
    queryFn: async () => {
      const res = await axios.get(API);
      return Array.isArray(res.data) ? (res.data as NovedadStockRow[]) : [];
    },
    staleTime: 30_000,
  });
}

export function useNovedadStockPreview(
  enabled: boolean,
  rates: { euroToCop: number | null; usdToCop: number | null },
) {
  const hasRates =
    rates.euroToCop != null &&
    rates.euroToCop > 0 &&
    rates.usdToCop != null &&
    rates.usdToCop > 0;

  return useQuery<NovedadStockPreviewResponse>({
    queryKey: [
      'homolog-novedad-stock-preview',
      rates.euroToCop,
      rates.usdToCop,
    ],
    enabled: enabled && hasRates,
    queryFn: async () => {
      const res = await axios.post(`${API}/preview`, {
        euro_to_cop: rates.euroToCop,
        usd_to_cop: rates.usdToCop,
      });
      return res.data as NovedadStockPreviewResponse;
    },
    staleTime: 15_000,
  });
}

export function useNovedadStockMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['homolog-novedad-stock'] }),
      queryClient.invalidateQueries({ queryKey: ['homolog-novedad-stock-preview'] }),
    ]);
  };

  const syncFromSession = useMutation({
    mutationFn: async (sessionId?: string) => {
      const res = await axios.post(`${API}/sync`, { session_id: sessionId });
      return res.data as { synced: number; items: NovedadStockRow[] };
    },
    onSuccess: invalidate,
  });

  const materialize = useMutation({
    mutationFn: async (args: {
      session_id?: string;
      euro_to_cop: number;
      usd_to_cop: number;
    }) => {
      const res = await axios.post(`${API}/materialize`, args);
      return res.data as { created: number; items: NovedadStockRow[] };
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] }),
      ]);
    },
  });

  const undoMaterialize = useMutation({
    mutationFn: async (args?: { session_id?: string; tracking_ids?: string[] }) => {
      const res = await axios.post(`${API}/undo-materialize`, args ?? {});
      return res.data as {
        reverted: number;
        failed: Array<{ tracking_id: string; card_name: string; reason: string }>;
        items: NovedadStockRow[];
      };
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] }),
      ]);
    },
  });

  const resolveRow = useMutation({
    mutationFn: async (id: string) => {
      await axios.patch(`${API}/${id}/resolve`);
    },
    onSuccess: invalidate,
  });

  return {
    syncFromSession,
    materialize,
    undoMaterialize,
    resolveRow,
    axiosMessage,
  };
}
