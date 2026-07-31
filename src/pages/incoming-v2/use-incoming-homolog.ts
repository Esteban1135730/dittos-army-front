import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiUrl } from '../../config/api';
import type { PanelHomologItem, SentHomologUnit } from '../../utils/sent-unit-homolog';

const API_HOMOLOG = apiUrl('/incoming/homolog');

export type HomologSession = {
  session_id: string;
  status: string;
  shipping_total_cop: number | null;
  ship_round_id: string | null;
  units: SentHomologUnit[];
  summary: {
    total: number;
    pending: number;
    verified: number;
    novedad: number;
  };
  cardtrader_synced_at: string;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
};

export type HomologSessionResponse = {
  session: HomologSession | null;
  panel_items: PanelHomologItem[];
  batches_summary?: TransitLotSummaryRow[];
  synced_count?: number;
};

export type TransitLotSummaryRow = {
  lot_id: string;
  purchase_date: string;
  total_fx_cards_cost: number;
  total_cop_cards_cost: number;
  real_fx_rate_cop: number;
  cards_cost_currency?: string;
  remaining_total_quantity: number;
  open_items_count: number;
};

/** @deprecated Alias de compatibilidad en respuestas antiguas. */
export type BatchSummaryRow = TransitLotSummaryRow;

export type BatchNovedadRow = {
  novedad_id: string;
  batch_item_id: string;
  batch_id: string;
  session_id: string | null;
  sent_unit_key: string | null;
  card_id: string;
  card_name: string;
  source: string;
  notes: string;
  resolved: boolean;
  created_at: string;
};

function axiosMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
  }
  return 'Error en la operación.';
}

export function useHomologActive() {
  return useQuery<HomologSessionResponse>({
    queryKey: ['incoming-homolog-active'],
    queryFn: async () => {
      const res = await axios.get(`${API_HOMOLOG}/active`);
      return res.data as HomologSessionResponse;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useHomologSession(sessionId: string | undefined) {
  return useQuery<HomologSessionResponse>({
    queryKey: ['incoming-homolog-session', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const res = await axios.get(`${API_HOMOLOG}/sessions/${sessionId}`);
      return res.data as HomologSessionResponse;
    },
  });
}

export function useHomologNovedades() {
  return useQuery<BatchNovedadRow[]>({
    queryKey: ['incoming-homolog-novedades'],
    queryFn: async () => {
      const res = await axios.get(`${API_HOMOLOG}/novedades`);
      return Array.isArray(res.data) ? (res.data as BatchNovedadRow[]) : [];
    },
  });
}

export function useHomologMutations() {
  const queryClient = useQueryClient();

  const invalidate = async (sessionId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] }),
      sessionId
        ? queryClient.invalidateQueries({
            queryKey: ['incoming-homolog-session', sessionId],
          })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ['incoming-homolog-novedades'] }),
    ]);
  };

  const createSession = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_HOMOLOG}/sessions`);
      return res.data as HomologSessionResponse;
    },
    onSuccess: async (data) => {
      await invalidate(data.session?.session_id);
    },
  });

  const syncSent = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await axios.post(`${API_HOMOLOG}/sessions/${sessionId}/sync`);
      return res.data as HomologSessionResponse;
    },
    onSuccess: async (_data, sessionId) => {
      await invalidate(sessionId);
    },
  });

  const verifyUnit = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      sentUnitKey: string;
      transitLineId: string;
      matchScore?: number;
    }) => {
      const key = encodeURIComponent(args.sentUnitKey);
      const res = await axios.patch(
        `${API_HOMOLOG}/sessions/${args.sessionId}/units/${key}/verify`,
        { transit_line_id: args.transitLineId, match_score: args.matchScore },
      );
      return res.data as HomologSessionResponse;
    },
    onSuccess: async (data, vars) => {
      queryClient.setQueryData(['incoming-homolog-active'], data);
      if (vars.sessionId) {
        queryClient.setQueryData(['incoming-homolog-session', vars.sessionId], data);
      }
      await invalidate(vars.sessionId);
    },
  });

  const markNovedad = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      sentUnitKey: string;
      notes: string;
      transitLineId?: string;
    }) => {
      const key = encodeURIComponent(args.sentUnitKey);
      const res = await axios.patch(
        `${API_HOMOLOG}/sessions/${args.sessionId}/units/${key}/novedad`,
        { notes: args.notes, transit_line_id: args.transitLineId },
      );
      return res.data as HomologSessionResponse;
    },
    onSuccess: async (data, vars) => {
      queryClient.setQueryData(['incoming-homolog-active'], data);
      if (vars.sessionId) {
        queryClient.setQueryData(['incoming-homolog-session', vars.sessionId], data);
      }
      await invalidate(vars.sessionId);
    },
  });

  const undoUnit = useMutation({
    mutationFn: async (args: { sessionId: string; sentUnitKey: string }) => {
      const key = encodeURIComponent(args.sentUnitKey);
      const res = await axios.patch(
        `${API_HOMOLOG}/sessions/${args.sessionId}/units/${key}/undo`,
      );
      return res.data as HomologSessionResponse;
    },
    onSuccess: async (data, vars) => {
      queryClient.setQueryData(['incoming-homolog-active'], data);
      if (vars.sessionId) {
        queryClient.setQueryData(['incoming-homolog-session', vars.sessionId], data);
      }
      await invalidate(vars.sessionId);
    },
  });

  const createTanda = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      shipping_total_cop: number;
      cards: Array<{
        sent_unit_key: string;
        transit_line_id: string;
        purchase_price_eur: number;
        unit_cost_cop: number;
        is_novedad?: boolean;
        novedad_notes?: string;
      }>;
    }) => {
      const res = await axios.post(
        `${API_HOMOLOG}/sessions/${args.sessionId}/create-tanda`,
        {
          shipping_total_cop: args.shipping_total_cop,
          cards: args.cards,
        },
      );
      return res.data as {
        round_id: string | null;
        transit_reception?: boolean;
        stock_created?: number;
        stock_ids?: string[];
      };
    },
    onSuccess: async (_data, vars) => {
      await invalidate(vars.sessionId);
    },
  });

  const cancelSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await axios.delete(`${API_HOMOLOG}/sessions/${sessionId}`);
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const resolveNovedad = useMutation({
    mutationFn: async (novedadId: string) => {
      await axios.patch(`${API_HOMOLOG}/novedades/${novedadId}/resolve`);
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const revertConversion = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await axios.post(
        `${API_HOMOLOG}/sessions/${sessionId}/revert-conversion`,
      );
      return res.data as HomologSessionResponse & { deleted_round_id?: string };
    },
    onSuccess: async (_data, sessionId) => {
      await invalidate(sessionId);
    },
  });

  return {
    createSession,
    syncSent,
    verifyUnit,
    markNovedad,
    undoUnit,
    createTanda,
    cancelSession,
    resolveNovedad,
    revertConversion,
    axiosMessage,
  };
}
