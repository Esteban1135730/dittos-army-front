import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiUrl } from '../../config/api';

const API_RECEIPT = apiUrl('/cardtrader/receipt');

export type ReceiptLineStatus = 'pending' | 'received' | 'inconsistency';
export type InconsistencyType = 'not_arrived' | 'wrong_quantity' | 'wrong_card';

export type ReceiptLine = {
  line_id: string;
  transit_line_id: string;
  transit_lot_id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language: string;
  rareza: string | null;
  collector_number: string | null;
  expansion: string | null;
  /** CT blueprint; opcional (sesiones antiguas pueden no traerlo). */
  blueprint_id: number | null;
  quantity_expected: number;
  fx_unit_price: number;
  unit_cost_cop: number;
  status: ReceiptLineStatus;
  received_qty: number | null;
  inconsistency_type: InconsistencyType | null;
  notes: string;
  stock_id: string | null;
};

export type ReceiptSession = {
  session_id: string;
  status: 'open' | 'finalized' | 'cancelled';
  lot_ids: string[];
  shipping_total_cop: number | null;
  created_at: string;
  finalized_at: string | null;
  lines: ReceiptLine[];
  summary: {
    total: number;
    pending: number;
    received: number;
    inconsistency: number;
  };
};

export type FinalizeResult = {
  session_id: string;
  stock_created: number;
  /** ObjectId hex de cada Stock creado; length === stock_created */
  stock_ids: string[];
  inconsistencies: Array<{
    line_id?: string;
    card_id?: string;
    card_name: string;
    inconsistency_type: InconsistencyType;
    notes: string;
  }>;
  shipping_total_cop: number;
};

export type ReceiptWizardStep = 1 | 2 | 3 | 4;

const STOCK_IDS_STORAGE_PREFIX = 'receipt-wizard-stock-ids:';

export function persistReceiptStockIds(
  sessionId: string,
  stockIds: string[],
): void {
  try {
    sessionStorage.setItem(
      `${STOCK_IDS_STORAGE_PREFIX}${sessionId}`,
      JSON.stringify(stockIds),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedReceiptStockIds(
  sessionId: string,
): string[] | null {
  try {
    const raw = sessionStorage.getItem(
      `${STOCK_IDS_STORAGE_PREFIX}${sessionId}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return null;
  }
}

export function clearPersistedReceiptStockIds(sessionId: string): void {
  try {
    sessionStorage.removeItem(`${STOCK_IDS_STORAGE_PREFIX}${sessionId}`);
  } catch {
    /* ignore */
  }
}

export const INCONSISTENCY_LABELS: Record<InconsistencyType, string> = {
  not_arrived: 'No llegó',
  wrong_quantity: 'Cantidad incorrecta',
  wrong_card: 'Carta equivocada',
};

function axiosMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
    const error = err.response?.data?.error;
    if (typeof error === 'string') return error;
  }
  return 'Error en la operación.';
}

export { axiosMessage };

// El backend devuelve { session: MongoDoc, lines: MongoDoc[] }.
// Esta función normaliza esa forma a ReceiptSession plana con summary calculado.
function normalizeRawSession(raw: unknown): ReceiptSession | null {
  if (!raw) return null;

  const r = raw as Record<string, unknown>;

  // Forma anidada: { session: {...}, lines: [...] }
  const sessionDoc = (r['session'] as Record<string, unknown> | undefined) ?? r;
  const linesRaw = (r['lines'] as unknown[]) ?? [];
  const postFinalize = r['post_finalize'] as
    | { stock_ids?: unknown; stock_created?: unknown }
    | undefined;

  const lines: ReceiptLine[] = linesRaw.map((l) => {
    const ld = l as Record<string, unknown>;
    return {
      line_id: String(ld['_id'] ?? ld['line_id'] ?? ''),
      transit_line_id: String(ld['transit_line_id'] ?? ''),
      transit_lot_id: String(ld['transit_lot_id'] ?? ''),
      card_id: String(ld['card_id'] ?? ''),
      card_name: String(ld['card_name'] ?? ''),
      image_url: String(ld['image_url'] ?? ''),
      language: String(ld['language'] ?? ''),
      rareza: (ld['rareza'] as string | null) ?? null,
      collector_number: (ld['collector_number'] as string | null) ?? null,
      expansion: (ld['expansion'] as string | null) ?? null,
      blueprint_id:
        ld['blueprint_id'] != null && Number(ld['blueprint_id']) > 0
          ? Number(ld['blueprint_id'])
          : null,
      quantity_expected: Number(ld['quantity_expected'] ?? 0),
      fx_unit_price: Number(ld['fx_unit_price'] ?? 0),
      unit_cost_cop: Number(ld['unit_cost_cop'] ?? 0),
      status: (ld['status'] as ReceiptLineStatus) ?? 'pending',
      received_qty: ld['received_qty'] != null ? Number(ld['received_qty']) : null,
      inconsistency_type: (ld['inconsistency_type'] as InconsistencyType | null) ?? null,
      notes: String(ld['notes'] ?? ''),
      stock_id: (ld['stock_id'] as string | null) ?? null,
    };
  });

  // Si post_finalize trae stock_ids y líneas aún no tienen stock_id, rellenar
  if (postFinalize && Array.isArray(postFinalize.stock_ids)) {
    const ids = postFinalize.stock_ids.filter(
      (id): id is string => typeof id === 'string',
    );
    let idx = 0;
    for (const line of lines) {
      if (line.status === 'received' && !line.stock_id && idx < ids.length) {
        line.stock_id = ids[idx++];
      }
    }
  }

  const summary = {
    total: lines.length,
    pending: lines.filter((l) => l.status === 'pending').length,
    received: lines.filter((l) => l.status === 'received').length,
    inconsistency: lines.filter((l) => l.status === 'inconsistency').length,
  };

  return {
    session_id: String(sessionDoc['_id'] ?? sessionDoc['session_id'] ?? ''),
    status: (sessionDoc['status'] as ReceiptSession['status']) ?? 'open',
    lot_ids: (sessionDoc['lot_ids'] as string[]) ?? [],
    shipping_total_cop: sessionDoc['shipping_total_cop'] != null
      ? Number(sessionDoc['shipping_total_cop'])
      : null,
    created_at: String(sessionDoc['created_at'] ?? ''),
    finalized_at: (sessionDoc['finalized_at'] as string | null) ?? null,
    lines,
    summary,
  };
}

export function useReceiptActiveSession() {
  return useQuery<ReceiptSession | null>({
    queryKey: ['cardtrader-receipt-session-active'],
    queryFn: async () => {
      const res = await axios.get(`${API_RECEIPT}/sessions/active`);
      return normalizeRawSession(res.data);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useReceiptSession(sessionId: string | undefined) {
  return useQuery<ReceiptSession>({
    queryKey: ['cardtrader-receipt-session', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const res = await axios.get(`${API_RECEIPT}/sessions/${sessionId}`);
      return normalizeRawSession(res.data) as ReceiptSession;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateReceiptSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // El back devuelve { session_id, status, lines_loaded, lot_ids } al crear.
      // Invalidamos la query de sesión activa para que recargue con la sesión completa.
      await axios.post(`${API_RECEIPT}/sessions`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['cardtrader-receipt-session-active'],
      });
    },
  });
}

export function useReceiveLine(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      lineId: string;
      received_qty: number;
      notes?: string;
    }) => {
      const res = await axios.patch(
        `${API_RECEIPT}/sessions/${sessionId}/lines/${args.lineId}/receive`,
        { received_qty: args.received_qty, notes: args.notes },
      );
      return res.data as ReceiptSession;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['cardtrader-receipt-session-active'],
      });
    },
  });
}

export function useMarkInconsistency(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      lineId: string;
      type: InconsistencyType;
      notes: string;
    }) => {
      const res = await axios.patch(
        `${API_RECEIPT}/sessions/${sessionId}/lines/${args.lineId}/inconsistency`,
        { type: args.type, notes: args.notes },
      );
      return res.data as ReceiptSession;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['cardtrader-receipt-session-active'],
      });
    },
  });
}

export function useUndoLine(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lineId: string) => {
      const res = await axios.patch(
        `${API_RECEIPT}/sessions/${sessionId}/lines/${lineId}/undo`,
      );
      return res.data as ReceiptSession;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['cardtrader-receipt-session-active'],
      });
    },
  });
}

export function useFinalizeReceipt(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shippingTotalCop: number) => {
      const res = await axios.post(
        `${API_RECEIPT}/sessions/${sessionId}/finalize`,
        { shipping_total_cop: shippingTotalCop },
      );
      return res.data as FinalizeResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['cardtrader-receipt-session-active'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['cardtrader-receipt-session', sessionId],
        }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
    },
  });
}

export function useRevertFinalization(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await axios.post(
        `${API_RECEIPT}/sessions/${sessionId}/revert`,
      );
      return res.data as ReceiptSession;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['cardtrader-receipt-session-active'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['cardtrader-receipt-session', sessionId],
        }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
    },
  });
}

export function useCancelReceiptSession(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axios.delete(`${API_RECEIPT}/sessions/${sessionId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['cardtrader-receipt-session-active'],
      });
    },
  });
}
