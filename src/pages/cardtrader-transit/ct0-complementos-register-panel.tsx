import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
import { apiUrl, getApiTcgHeader } from "../../config/api";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import {
  buildComplementosPackageKey,
  filterCt0ComplementItems,
} from "../../utils/cardtrader-ct0-box";
import type { TcgdexResolveResponse } from "../../utils/cardtrader-order-item-map";
import {
  buildComplementosDraftLines,
  buildComplementosTransitLotPayload,
  resolveComplementosDraftTcgdex,
  type ComplementosDraftLine,
} from "../../utils/ct0-incoming-batch-draft";
import { API_CARDTRADER_TRANSIT_LOTS } from "../cardtrader-transit/cardtrader-transit-types";
import { TransitLotOwnerSelect } from "../cardtrader-transit/transit-lot-owner-select";
import {
  OWNERS_CONFIG,
  defaultOwnerForTcg,
  type OwnerKey,
} from "../../config/owners";

const API_CARDTRADER = apiUrl("/cardtrader");
const API_TCG_FIND = apiUrl("/tcg-dex/card/find");

function purchaseDateToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type Ct0ComplementosRegisterPanelProps = {
  ct0Items: Ct0BoxItem[];
  registeredPackageKeys?: string[];
  loading?: boolean;
  /** CardTrader `game_id` del panel activo. */
  gameId?: number | null;
};

export default function Ct0ComplementosRegisterPanel(
  props: Ct0ComplementosRegisterPanelProps,
) {
  const { ct0Items, registeredPackageKeys = [], loading, gameId } = props;
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState("");
  const [owner, setOwner] = useState<OwnerKey>(() =>
    defaultOwnerForTcg(getApiTcgHeader()),
  );

  const complementItems = useMemo(
    () => filterCt0ComplementItems(ct0Items, gameId),
    [ct0Items, gameId],
  );

  const packageKey = useMemo(
    () => buildComplementosPackageKey(complementItems.map((i) => i.id)),
    [complementItems],
  );

  const alreadyRegistered = registeredPackageKeys.includes(packageKey);

  const baseLines = useMemo(
    () => buildComplementosDraftLines(complementItems),
    [complementItems],
  );

  const resolveQuery = useQuery({
    queryKey: [
      "ct0-complementos-resolved",
      baseLines
        .map((l) => `${l.ct0ItemId}:${l.collectorNumber}:${l.blueprintId}`)
        .join("|"),
    ],
    enabled: baseLines.length > 0 && !alreadyRegistered && !loading,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      resolveComplementosDraftTcgdex(
        baseLines,
        async ({ expansion, collectorNumber, language, blueprintId, name }) => {
          const res = await axios.get(`${API_CARDTRADER}/tcgdex/resolve`, {
            params: {
              expansion,
              collector_number: collectorNumber ?? undefined,
              name: name?.trim() || undefined,
              language: language !== "—" ? language : undefined,
              blueprint_id: blueprintId && blueprintId > 0 ? blueprintId : undefined,
            },
          });
          return res.data as TcgdexResolveResponse;
        },
      ),
  });

  const lines: ComplementosDraftLine[] = resolveQuery.data ?? baseLines.map((l) => ({
    ...l,
    tcgdexCardId: null,
    tcgdexError: alreadyRegistered ? null : "pendiente de homologación",
  }));

  const unresolved = lines.filter((l) => !l.tcgdexCardId).length;
  const ready = unresolved === 0 && lines.length > 0 && !alreadyRegistered;

  const imageQuery = useQuery({
    queryKey: [
      "ct0-complementos-images",
      lines.map((l) => l.tcgdexCardId).filter(Boolean).join(","),
    ],
    enabled: lines.some((l) => l.tcgdexCardId),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const images: Record<string, string> = {};
      await Promise.all(
        lines
          .filter((l) => l.tcgdexCardId)
          .map(async (l) => {
            const cardId = l.tcgdexCardId!;
            try {
              const res = await axios.get(
                `${API_TCG_FIND}/${encodeURIComponent(cardId)}`,
                { params: { locale: l.language === "ja" ? "ja" : "en" } },
              );
              const img =
                (typeof res.data?.image === "string" && res.data.image.trim()) ||
                (typeof res.data?.images?.small === "string" &&
                  res.data.images.small.trim()) ||
                "";
              if (img) images[cardId] = img;
            } catch {
              /* optional */
            }
          }),
      );
      return images;
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload = buildComplementosTransitLotPayload(
        lines,
        purchaseDateToday(),
        packageKey,
        owner,
      );
      if (payload.items.length === 0) {
        throw new Error("No hay líneas con ID TCGdex para registrar.");
      }
      const res = await axios.post(API_CARDTRADER_TRANSIT_LOTS, payload);
      return res.data as { lot_id?: string };
    },
    onSuccess: async (data) => {
      setMsg(
        data.lot_id
          ? `✅ Lote complementos creado (${data.lot_id}).`
          : "✅ Lote complementos registrado.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lots-open"] }),
        queryClient.invalidateQueries({ queryKey: ["cardtrader", "ct0-box-items"] }),
        queryClient.invalidateQueries({
          queryKey: ["cardtrader-transit-registered-keys"],
        }),
      ]);
    },
    onError: (e: unknown) => {
      const err = e as {
        response?: { data?: { message?: string; error?: string }; status?: number };
        message?: string;
      };
      setMsg(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "No se pudo registrar el lote de complementos.",
      );
    },
  });

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
        <CircularProgress size={22} />
        <Typography variant="body2">Cargando complementos…</Typography>
      </Box>
    );
  }

  if (complementItems.length === 0) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 3, borderTop: 4, borderColor: "#2e7d32" }}>
      <Typography variant="h6" gutterBottom>
        Complementos CT0 (precio $0)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cartas regaladas o reemplazadas por CardTrader. Se registran en tránsito con{" "}
        <strong>costo de carta 0</strong> (el envío no entra aquí).
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip label={`${lines.length} líneas`} size="small" />
        <Chip
          label={alreadyRegistered ? "Ya registrado" : ready ? "Listo" : `${unresolved} sin ID`}
          color={alreadyRegistered ? "default" : ready ? "success" : "error"}
          size="small"
        />
      </Stack>

      {msg ? (
        <Alert
          severity={msg.startsWith("✅") ? "success" : "error"}
          sx={{ mb: 2 }}
          onClose={() => setMsg("")}
        >
          {msg}{" "}
          {msg.includes("lote") && msg.includes("✅") ? (
            <RouterLink to="/cardtrader-transit">Ver lotes</RouterLink>
          ) : null}
        </Alert>
      ) : null}

      {resolveQuery.isFetching ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="caption">Resolviendo TCGdex…</Typography>
        </Box>
      ) : null}

      <Stack spacing={1} sx={{ mb: 2 }}>
        {lines.map((line) => {
          const img = line.tcgdexCardId
            ? imageQuery.data?.[line.tcgdexCardId]
            : undefined;
          return (
            <Paper
              key={line.lineKey}
              variant="outlined"
              sx={{
                p: 1.5,
                display: "flex",
                gap: 1.5,
                bgcolor: line.tcgdexCardId ? "#f1f8e9" : "#ffebee",
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 78,
                  bgcolor: "grey.100",
                  borderRadius: 1,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {img ? (
                  <Box
                    component="img"
                    src={img}
                    alt={line.name}
                    sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : null}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2">{line.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {line.expansion} · #{line.collectorNumber ?? "—"} · {line.language} · qty{" "}
                  {line.qty} · $0
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  {line.tcgdexCardId ?? line.tcgdexError ?? "Sin ID"}
                </Typography>
              </Box>
            </Paper>
          );
        })}
      </Stack>

      {!alreadyRegistered ? (
        <Box sx={{ maxWidth: 280, mb: 2 }}>
          <TransitLotOwnerSelect
            id="complementos"
            value={owner}
            onChange={setOwner}
            disabled={registerMutation.isPending}
          />
        </Box>
      ) : null}

      <Button
        variant="contained"
        color="success"
        disabled={!ready || registerMutation.isPending || alreadyRegistered}
        onClick={() => registerMutation.mutate()}
      >
        {registerMutation.isPending
          ? "Registrando…"
          : alreadyRegistered
            ? "Complementos ya registrados"
            : "Registrar lote complementos"}
      </Button>
    </Paper>
  );
}
