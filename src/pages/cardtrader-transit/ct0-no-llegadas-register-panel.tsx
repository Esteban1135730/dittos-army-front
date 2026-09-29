import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import {
  filterCt0MissingItems,
  matchMissingToTransitLines,
} from "../../utils/cardtrader-ct0-box";
import {
  API_CARDTRADER_TRANSIT_LOTS,
  type CardtraderTransitLineRow,
  type CardtraderTransitLotRow,
} from "./cardtrader-transit-types";

export type Ct0NoLlegadasRegisterPanelProps = {
  ct0Items: Ct0BoxItem[];
  openLots: CardtraderTransitLotRow[];
  loading?: boolean;
  /** CardTrader `game_id` del panel activo. */
  gameId?: number | null;
};

type MarkNotArrivedResult = {
  marked: Array<{ ct0_item_id: number; transit_line_id: string }>;
  already_marked: Array<{ ct0_item_id: number; transit_line_id: string }>;
  not_found: number[];
};

export default function Ct0NoLlegadasRegisterPanel(
  props: Ct0NoLlegadasRegisterPanelProps,
) {
  const { ct0Items, openLots, loading, gameId } = props;
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState("");

  const missingItems = useMemo(
    () => filterCt0MissingItems(ct0Items, gameId),
    [ct0Items, gameId],
  );

  const lotIdsKey = openLots.map((l) => l.lot_id).join(",");

  const linesQuery = useQuery({
    queryKey: ["cardtrader-transit-lines-for-no-llegadas", lotIdsKey],
    enabled: openLots.length > 0 && missingItems.length > 0 && !loading,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const rows: CardtraderTransitLineRow[] = [];
      await Promise.all(
        openLots.map(async (lot) => {
          const res = await axios.get(
            `${API_CARDTRADER_TRANSIT_LOTS}/${encodeURIComponent(lot.lot_id)}/lines`,
          );
          if (Array.isArray(res.data)) {
            rows.push(...(res.data as CardtraderTransitLineRow[]));
          }
        }),
      );
      return rows;
    },
  });

  const matched = useMemo(
    () =>
      matchMissingToTransitLines(missingItems, linesQuery.data ?? []),
    [missingItems, linesQuery.data],
  );

  const markableIds = useMemo(
    () =>
      matched
        .filter((m) => m.transit_line_id && !m.already_marked)
        .map((m) => m.item.id),
    [matched],
  );

  const markMutation = useMutation({
    mutationFn: async () => {
      if (markableIds.length === 0) {
        throw new Error("No hay cartas no llegadas vinculables para marcar.");
      }
      const res = await axios.post(
        `${API_CARDTRADER_TRANSIT_LOTS}/mark-not-arrived`,
        { ct0_item_ids: markableIds },
      );
      return res.data as MarkNotArrivedResult;
    },
    onSuccess: async (data) => {
      setMsg(
        `✅ Marcadas: ${data.marked.length}` +
          (data.already_marked.length
            ? ` · Ya marcadas: ${data.already_marked.length}`
            : "") +
          (data.not_found.length ? ` · Sin línea: ${data.not_found.length}` : "") +
          ". Reexporta Próximamente para actualizar la tienda.",
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["cardtrader-transit-lots-open"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["cardtrader-transit-lines-for-no-llegadas"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["cardtrader", "ct0-box-items"],
        }),
      ]);
    },
    onError: (e: unknown) => {
      const err = e as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      setMsg(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "No se pudieron marcar las cartas no llegadas.",
      );
    },
  });

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
        <CircularProgress size={22} />
        <Typography variant="body2">Cargando cartas no llegadas…</Typography>
      </Box>
    );
  }

  if (missingItems.length === 0) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 3, borderTop: 4, borderColor: "#ef6c00" }}>
      <Typography variant="h6" gutterBottom>
        Cartas no llegadas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ítems CT0 en estado <strong>missing</strong>. Al marcar, quedan etiquetadas en
        tránsito y dejan de salir en Próximamente (sin cambiar la cantidad pendiente).
        Solo se pueden marcar si hay línea con el mismo <code>ct0_item_id</code>.
      </Typography>

      {linesQuery.isLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2">Cruzando con tránsito…</Typography>
        </Box>
      ) : null}

      <Stack spacing={1} sx={{ mb: 2 }}>
        {matched.map(({ item, transit_line_id, already_marked }) => (
          <Box
            key={item.id}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                CT0 #{item.id}
                {item.formatted_price ? ` · ${item.formatted_price}` : ""}
                {item.expansion ? ` · ${item.expansion}` : ""}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {!transit_line_id ? (
                <Chip size="small" label="Sin línea de tránsito" variant="outlined" />
              ) : already_marked ? (
                <Chip size="small" color="warning" label="Ya marcada" />
              ) : (
                <Chip size="small" color="default" label="Lista para marcar" />
              )}
            </Stack>
          </Box>
        ))}
      </Stack>

      {msg ? (
        <Alert
          severity={msg.startsWith("✅") ? "success" : "error"}
          sx={{ mb: 2 }}
          onClose={() => setMsg("")}
        >
          {msg}
        </Alert>
      ) : null}

      <Button
        variant="contained"
        color="warning"
        disabled={markableIds.length === 0 || markMutation.isPending}
        onClick={() => markMutation.mutate()}
      >
        {markMutation.isPending
          ? "Marcando…"
          : markableIds.length === 0
            ? "Nada pendiente de marcar"
            : `Marcar cartas no llegadas (${markableIds.length})`}
      </Button>
    </Paper>
  );
}
