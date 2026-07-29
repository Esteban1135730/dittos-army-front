import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { apiUrl } from "../../../config/api";
import type {
  StockReviewOutcome,
  StockReviewScanResponse,
  StockReviewSession,
  CreateStockReviewSessionBody,
} from "./types";

export function stockReviewSessionQueryKey(sessionId: string) {
  return ["stock-review", "session", sessionId] as const;
}

/** Acepta 200 y 201 (Nest devolvía 201 en POST). */
function isHttpSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

export function writeStockReviewSessionCache(
  queryClient: QueryClient,
  session: StockReviewSession,
  routeSessionId?: string,
): void {
  const ids = new Set(
    [session.id, routeSessionId].filter((id): id is string => Boolean(id)),
  );
  for (const id of ids) {
    queryClient.setQueryData(stockReviewSessionQueryKey(id), { session });
  }
  const active = queryClient.getQueryData<{
    session: StockReviewSession | null;
  }>(["stock-review", "active"]);
  if (active?.session?.id === session.id) {
    queryClient.setQueryData(["stock-review", "active"], { session });
  }
}

function recalcSessionSummary(items: StockReviewSession["items"]) {
  const active = items.filter((i) => !i.obsolete);
  const verified = active.filter((i) => i.verified).length;
  const resolved = active.filter((i) => i.outcome != null).length;
  const pending_resolution = active.filter(
    (i) => !i.verified && i.outcome == null,
  ).length;
  return {
    verified,
    pending_verification: active.length - verified,
    pending_resolution,
    resolved,
  };
}

export function patchSessionItemVerified(
  session: StockReviewSession,
  stockId: string,
): StockReviewSession {
  const items = session.items.map((item) =>
    item.stock_id === stockId ? { ...item, verified: true } : item,
  );
  const summary = recalcSessionSummary(items);
  return {
    ...session,
    items,
    summary: {
      ...session.summary,
      ...summary,
    },
  };
}

export function patchSessionItemResolved(
  session: StockReviewSession,
  stockId: string,
  outcome: StockReviewOutcome,
): StockReviewSession {
  const items = session.items.map((item) =>
    item.stock_id === stockId ? { ...item, outcome } : item,
  );
  const summary = recalcSessionSummary(items);
  return {
    ...session,
    items,
    summary: {
      ...session.summary,
      ...summary,
    },
  };
}

export function useStockReviewActive() {
  return useQuery<{ session: StockReviewSession | null }>({
    queryKey: ["stock-review", "active"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/stock-review/active"));
      return res.data;
    },
  });
}

export function useStockReviewSession(sessionId: string | undefined) {
  return useQuery<{ session: StockReviewSession }>({
    queryKey: ["stock-review", "session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const res = await axios.get(
        apiUrl(`/stock-review/sessions/${sessionId}`)
      );
      return res.data;
    },
  });
}

export function useStockReviewMutations() {
  const queryClient = useQueryClient();

  const invalidate = async (sessionId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["stock-review"] });
    if (sessionId) {
      await queryClient.invalidateQueries({
        queryKey: ["stock-review", "session", sessionId],
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
    await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["stock", "perdidas"] });
  };

  const createSession = useMutation({
    mutationFn: async (body: CreateStockReviewSessionBody) => {
      const res = await axios.post<{ session: StockReviewSession }>(
        apiUrl("/stock-review/sessions"),
        body,
      );
      return res.data.session;
    },
    onSuccess: () => invalidate(),
  });

  const setSessionCache = (
    session: StockReviewSession,
    routeSessionId?: string,
  ) => {
    writeStockReviewSessionCache(queryClient, session, routeSessionId);
  };

  const verifyItem = useMutation({
    mutationFn: async ({
      sessionId,
      stockId,
    }: {
      sessionId: string;
      stockId: string;
    }) => {
      const res = await axios.patch<{ session: StockReviewSession }>(
        apiUrl(
          `/stock-review/sessions/${sessionId}/items/${stockId}/verify`,
        ),
      );
      return res.data.session;
    },
    onSuccess: (session, { sessionId }) => setSessionCache(session, sessionId),
  });

  /**
   * El servidor decide qué unidad del grupo carta+idioma se verifica, así que
   * no hay optimismo local: se refresca la sesión con su respuesta.
   */
  const scanItem = useMutation({
    mutationFn: async ({
      sessionId,
      stockId,
    }: {
      sessionId: string;
      stockId: string;
    }) => {
      const res = await axios.post<StockReviewScanResponse>(
        apiUrl(`/stock-review/sessions/${sessionId}/scan`),
        { stock_id: stockId },
        { validateStatus: isHttpSuccess },
      );
      return res.data;
    },
    onSuccess: (data, { sessionId }) => {
      setSessionCache(data.session, sessionId);
      void queryClient.invalidateQueries({
        queryKey: stockReviewSessionQueryKey(sessionId),
      });
    },
  });

  const invalidateStockSideEffects = () => {
    void queryClient.invalidateQueries({ queryKey: ["stock"] });
    void queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["stock", "perdidas"] });
  };

  const finalizeVerification = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await axios.post<{ session: StockReviewSession }>(
        apiUrl(`/stock-review/sessions/${sessionId}/finalize-verification`),
        undefined,
        { validateStatus: isHttpSuccess },
      );
      return res.data.session;
    },
    onSuccess: (session, sessionId) => {
      setSessionCache(session, sessionId);
      void queryClient.invalidateQueries({ queryKey: ["stock-review", "active"] });
    },
  });

  const resolveItem = useMutation({
    mutationFn: async ({
      sessionId,
      stockId,
      outcome,
      amount_cop,
    }: {
      sessionId: string;
      stockId: string;
      outcome: StockReviewOutcome;
      amount_cop?: number;
    }) => {
      const res = await axios.post<{ session: StockReviewSession }>(
        apiUrl(
          `/stock-review/sessions/${sessionId}/items/${stockId}/resolve`,
        ),
        { outcome, amount_cop },
        { validateStatus: isHttpSuccess },
      );
      return res.data.session;
    },
    onMutate: async ({ sessionId, stockId, outcome }) => {
      await queryClient.cancelQueries({
        queryKey: stockReviewSessionQueryKey(sessionId),
      });
      const prev = queryClient.getQueryData<{ session: StockReviewSession }>(
        stockReviewSessionQueryKey(sessionId),
      );
      if (prev?.session) {
        setSessionCache(
          patchSessionItemResolved(prev.session, stockId, outcome),
          sessionId,
        );
      }
      return { prev, sessionId };
    },
    onError: (_err, { sessionId }, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          stockReviewSessionQueryKey(sessionId),
          ctx.prev,
        );
      }
    },
    onSuccess: (session, { sessionId }) => {
      setSessionCache(session, sessionId);
      invalidateStockSideEffects();
    },
  });

  /**
   * La sesión cancelada deja de existir: se limpian sus cachés en vez de
   * esperar refetches pesados, que retrasaban el cierre de la pantalla.
   */
  const cancelSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await axios.delete(apiUrl(`/stock-review/sessions/${sessionId}`), {
        validateStatus: isHttpSuccess,
      });
    },
    onSuccess: (_data, sessionId) => {
      queryClient.removeQueries({
        queryKey: stockReviewSessionQueryKey(sessionId),
      });
      queryClient.setQueryData(["stock-review", "active"], { session: null });
      void queryClient.invalidateQueries({
        queryKey: ["stock-review", "active"],
      });
    },
  });

  return {
    createSession,
    verifyItem,
    scanItem,
    finalizeVerification,
    resolveItem,
    cancelSession,
  };
}
