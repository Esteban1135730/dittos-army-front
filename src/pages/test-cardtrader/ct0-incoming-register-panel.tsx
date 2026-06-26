import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiUrl } from "../../config/api";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import {
  buildCt0IncomingBatchDrafts,
  buildInitialCopByPackageKey,
  buildTransitLotPayloadFromDraft,
  draftsEligibleForRegistration,
  parseCopInput,
  resolveCt0BatchDraftTcgdex,
  suggestedCopForDraft,
  type Ct0BatchDraft,
  type ExistingTransitLotRef,
  type IncomingBatchBundleForCt0Draft,
} from "../../utils/ct0-incoming-batch-draft";
import { findBatchItemForCardName } from "../../utils/incoming-ct0-package-match";
import { unitCostCopFromBatchItemRuleOfThree } from "../../utils/purchase-currency";
import { formatCop } from "../../utils/cardtrader-order-pricing";
import type { TcgdexResolveResponse } from "../../utils/cardtrader-order-item-map";
import { API_CARDTRADER_TRANSIT_LOTS } from "../cardtrader-transit/cardtrader-transit-types";
import { useCt0DraftBlueprintImages } from "../../utils/use-ct0-draft-blueprint-images";

const API_CARDTRADER = apiUrl("/cardtrader");

function statusChip(status: Ct0BatchDraft["status"]) {
  switch (status) {
    case "already_registered":
      return <Chip size="small" color="success" label="Ya registrado" />;
    case "ready":
      return <Chip size="small" color="primary" label="Listo para registrar" />;
    case "homolog_error":
      return <Chip size="small" color="error" label="Sin homologación TCGdex" />;
  }
}

function DraftLineRow(props: {
  line: Ct0BatchDraft["lines"][number];
  imageSrc?: string;
  imageLoading?: boolean;
  fxCurrency?: string;
  legacyRealFxRateCop?: number | null;
  legacyBatchItems?: IncomingBatchBundleForCt0Draft["items"];
}) {
  const {
    line,
    imageSrc,
    imageLoading,
    fxCurrency = "USD",
    legacyRealFxRateCop,
    legacyBatchItems,
  } = props;
  const hasError = !!line.tcgdexError && !line.tcgdexCardId;
  const fxUnit = line.qty > 0 ? line.usdTotalLot / line.qty : 0;
  const matchedLegacyItem = legacyBatchItems?.length
    ? findBatchItemForCardName(line.name, legacyBatchItems)
    : undefined;
  const copUnit =
    unitCostCopFromBatchItemRuleOfThree(fxUnit, matchedLegacyItem ?? {}) ??
    (legacyRealFxRateCop != null && legacyRealFxRateCop > 0
      ? fxUnit * legacyRealFxRateCop
      : null);
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        bgcolor: hasError ? "#ffebee" : "#fafafa",
        borderColor: hasError ? "#c62828" : "#e0e0e0",
      }}
    >
      <Box
        sx={{
          width: 72,
          minWidth: 72,
          height: 100,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "grey.100",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageLoading ? (
          <Skeleton variant="rounded" width={72} height={100} />
        ) : imageSrc ? (
          <Box
            component="img"
            src={imageSrc}
            alt={line.name}
            loading="lazy"
            sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, textAlign: "center" }}>
            Sin imagen
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {line.qty}× {line.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {line.language}
          {line.rareza ? ` · ${line.rareza}` : ""} · {line.expansion}
          {line.collectorNumber ? ` · #${line.collectorNumber}` : ""}
        </Typography>
        {line.tcgdexCardId ? (
          <Typography variant="caption" color="success.dark" display="block">
            TCGdex: {line.tcgdexCardId}
          </Typography>
        ) : line.tcgdexError ? (
          <Typography variant="caption" color="error.main" display="block">
            {line.tcgdexError}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ textAlign: "right", minWidth: 108, flexShrink: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {fxCurrency} {fxUnit.toFixed(2)}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          / ud · {fxCurrency} {line.usdTotalLot.toFixed(2)} lote
        </Typography>
        {copUnit != null && copUnit > 0 ? (
          <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.5 }}>
            {formatCop(copUnit)}/ud
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}

function DraftLotRow(props: {
  draft: Ct0BatchDraft;
  expanded: boolean;
  onToggle: () => void;
  copInput: string;
  onCopChange: (value: string) => void;
  blueprintImages: Record<number, string>;
  imagesLoading: boolean;
  legacyIncomingBundles: IncomingBatchBundleForCt0Draft[];
}) {
  const {
    draft,
    expanded,
    onToggle,
    copInput,
    onCopChange,
    blueprintImages,
    imagesLoading,
    legacyIncomingBundles,
  } = props;
  const legacyBatchItems =
    draft.legacyBatchId != null
      ? legacyIncomingBundles.find((b) => b.batchId === draft.legacyBatchId)?.items
      : undefined;
  const borderColor =
    draft.status === "homolog_error"
      ? "#c62828"
      : draft.status === "already_registered"
        ? "#2e7d32"
        : "#1565c0";

  return (
    <Paper sx={{ mb: 2, overflow: "hidden", borderTop: 4, borderColor }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        sx={{
          p: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <IconButton
            size="small"
            sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
          >
            ▼
          </IconButton>
          <Box>
            <Typography variant="h6">{draft.paidAtLabel}</Typography>
            <Typography variant="body2" color="text.secondary">
              {draft.lines.length} líneas · {draft.totalUnits} uds · ${draft.usdSubtotal.toFixed(2)}{" "}
              USD
            </Typography>
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
              {statusChip(draft.status)}
              {draft.transitLotId ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Lote ${draft.transitLotId.slice(-6)}`}
                  component={RouterLink}
                  to={`/cardtrader-transit/lot/${draft.transitLotId}`}
                  clickable
                />
              ) : null}
              {draft.legacyCopAutoFilled && draft.legacyCopHint ? (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`COP legacy ${formatCop(draft.legacyCopHint)}`}
                />
              ) : null}
              {draft.legacyRealFxRateCop != null &&
              draft.legacyRealFxRateCop > 0 &&
              draft.legacyCardsCostCurrency ? (
                <Chip
                  size="small"
                  variant="outlined"
                  color="info"
                  label={`Tasa legacy ${Math.round(draft.legacyRealFxRateCop).toLocaleString("es-CO")} COP/${draft.legacyCardsCostCurrency}`}
                />
              ) : null}
              {draft.legacyTotalFxCardsCost != null && draft.legacyTotalFxCardsCost > 0 ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`FX lote ${draft.legacyTotalFxCardsCost.toFixed(2)} ${draft.legacyCardsCostCurrency ?? "USD"}`}
                />
              ) : null}
              {draft.legacyBatchId && draft.legacyCopHint ? (
                <Chip
                  size="small"
                  variant="outlined"
                  color="warning"
                  label={`Legacy COP ${formatCop(draft.legacyCopHint)}`}
                  component={RouterLink}
                  to={`/incoming/batch/${draft.legacyBatchId}`}
                  clickable
                />
              ) : null}
              {draft.unresolvedCount > 0 ? (
                <Chip size="small" color="error" variant="outlined" label={`${draft.unresolvedCount} sin TCGdex`} />
              ) : null}
            </Box>
          </Box>
        </Box>

        {draft.status === "ready" ? (
          <Box onClick={(e) => e.stopPropagation()} sx={{ minWidth: 200 }}>
            <TextField
              fullWidth
              size="small"
              label="Total COP cartas (sin envío)"
              value={copInput}
              onChange={(e) => onCopChange(e.target.value)}
              placeholder={
                draft.legacyCopHint
                  ? `Sugerido: ${Math.round(draft.legacyCopHint).toLocaleString("es-CO")}`
                  : "Ej: 350000"
              }
              helperText={
                draft.legacyCopAutoFilled
                  ? draft.legacyRealFxRateCop != null && draft.legacyCardsCostCurrency
                    ? `COP por carta: regla de tres desde tu registro (COP÷FX de cada carta) × USD CT0`
                    : "COP tomado del lote legacy (fecha + cantidades coincidentes)"
                  : draft.legacyCopHint
                    ? "Valor sugerido desde compras en camino (legacy)"
                    : undefined
              }
            />
          </Box>
        ) : null}
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
          {draft.lines.map((line) => (
            <DraftLineRow
              key={line.lineKey}
              line={line}
              fxCurrency={draft.legacyCardsCostCurrency ?? "USD"}
              legacyRealFxRateCop={draft.legacyRealFxRateCop}
              legacyBatchItems={legacyBatchItems}
              imageSrc={line.blueprintId ? blueprintImages[line.blueprintId] : undefined}
              imageLoading={
                imagesLoading && !!line.blueprintId && !blueprintImages[line.blueprintId]
              }
            />
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}

export type Ct0IncomingRegisterPanelProps = {
  ct0Items: Ct0BoxItem[];
  existingTransitLots: ExistingTransitLotRef[];
  legacyIncomingBundles: IncomingBatchBundleForCt0Draft[];
  loading?: boolean;
  compact?: boolean;
};

export default function Ct0IncomingRegisterPanel(props: Ct0IncomingRegisterPanelProps) {
  const { ct0Items, existingTransitLots, legacyIncomingBundles, loading, compact } = props;
  const queryClient = useQueryClient();

  const baseDrafts = useMemo(
    () =>
      buildCt0IncomingBatchDrafts({
        ct0Items,
        existingTransitLots,
        legacyIncomingBundles,
      }),
    [ct0Items, existingTransitLots, legacyIncomingBundles],
  );

  const resolveQuery = useQuery({
    queryKey: [
      "ct0-incoming-batch-drafts-resolved",
      baseDrafts.map((d) => `${d.packageKey}:${d.status}`).join("|"),
    ],
    enabled: baseDrafts.some((d) => d.status !== "already_registered") && !loading,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      resolveCt0BatchDraftTcgdex(baseDrafts, async ({ expansion, collectorNumber }) => {
        const res = await axios.get(`${API_CARDTRADER}/tcgdex/resolve`, {
          params: {
            expansion,
            collector_number: collectorNumber ?? undefined,
          },
        });
        return res.data as TcgdexResolveResponse;
      }),
  });

  const drafts = resolveQuery.data ?? baseDrafts;

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [copByPackageKey, setCopByPackageKey] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [registerMsg, setRegisterMsg] = useState("");

  useEffect(() => {
    const defaults = buildInitialCopByPackageKey(drafts);
    if (Object.keys(defaults).length === 0) return;
    setCopByPackageKey((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(defaults)) {
        if (!parseCopInput(prev[key] ?? "")) next[key] = value;
      }
      return next;
    });
  }, [drafts]);

  const eligible = useMemo(() => draftsEligibleForRegistration(drafts), [drafts]);
  const homologErrors = drafts.filter((d) => d.status === "homolog_error");
  const registered = drafts.filter((d) => d.status === "already_registered");

  const registerMutation = useMutation({
    mutationFn: async (toRegister: Ct0BatchDraft[]) => {
      const created: string[] = [];
      const skipped: string[] = [];

      for (const draft of toRegister) {
        const cop = suggestedCopForDraft(draft, copByPackageKey);
        if (cop == null) {
          skipped.push(`${draft.paidAtLabel}: falta COP`);
          continue;
        }
        if (draft.lines.some((l) => !l.tcgdexCardId)) {
          skipped.push(`${draft.paidAtLabel}: líneas sin TCGdex`);
          continue;
        }

        const body = buildTransitLotPayloadFromDraft(draft, cop);
        const res = await axios.post(API_CARDTRADER_TRANSIT_LOTS, body);
        const lotId = res.data?.lot_id as string;
        if (lotId) created.push(lotId);
      }

      return { created, skipped };
    },
    onSuccess: async ({ created, skipped }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-lots-open"] }),
        queryClient.invalidateQueries({ queryKey: ["cardtrader-transit-package-keys"] }),
        queryClient.invalidateQueries({ queryKey: ["ct0-incoming-batch-drafts-resolved"] }),
      ]);

      if (created.length > 0) {
        setRegisterMsg(`✅ ${created.length} lote(s) registrados en tránsito CardTrader.`);
      }
      if (skipped.length > 0) {
        setRegisterMsg((prev) => `${prev} Omitidos: ${skipped.join("; ")}`.trim());
      }
      setDialogOpen(false);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string; error?: string } } };
      setRegisterMsg(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "No se pudieron registrar los lotes.",
      );
    },
  });

  const openRegisterDialog = () => {
    setRegisterMsg("");
    const missingCop = eligible.filter((d) => suggestedCopForDraft(d, copByPackageKey) == null);
    if (missingCop.length > 0) {
      setExpandedKeys(new Set(missingCop.map((d) => d.packageKey)));
      setRegisterMsg("Ingresa el total COP de cada lote listo antes de registrar.");
      return;
    }
    setDialogOpen(true);
  };

  const confirmRegister = () => {
    registerMutation.mutate(eligible);
  };

  const toggleDraft = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resolving = resolveQuery.isLoading || resolveQuery.isFetching;
  const { images: blueprintImages, isLoading: blueprintImagesLoading } = useCt0DraftBlueprintImages(
    drafts,
    ct0Items,
  );

  return (
    <Paper sx={{ p: 2, mb: compact ? 0 : 3, borderTop: 4, borderColor: "#6a1b9a" }}>
      {!compact ? (
        <>
          <Typography variant="h6" gutterBottom>
            Registrar desde CT Zero
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Crea lotes en las tablas nuevas de tránsito CardTrader. El valor COP puede tomarse del
            lote legacy (compras en camino) como referencia. Sin homologación TCGdex = rojo, no se
            guarda.
          </Typography>
        </>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
          <Typography variant="h6">{drafts.length}</Typography>
          <Typography variant="caption">Lotes CT Zero</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
          <Typography variant="h6" color="primary.main">
            {eligible.length}
          </Typography>
          <Typography variant="caption">Listos</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
          <Typography variant="h6" color="success.main">
            {registered.length}
          </Typography>
          <Typography variant="caption">Ya registrados</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
          <Typography variant="h6" color="error.main">
            {homologErrors.length}
          </Typography>
          <Typography variant="caption">Sin TCGdex</Typography>
        </Paper>
      </Box>

      {loading || resolving ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
          <CircularProgress size={22} />
          <Typography variant="body2">
            {loading ? "Cargando CT Zero…" : "Homologando IDs CardTrader → TCGdex…"}
          </Typography>
        </Box>
      ) : drafts.length === 0 ? (
        <Alert severity="info">No hay cartas en tránsito en CT Zero (ok + pending).</Alert>
      ) : (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              disabled={eligible.length === 0 || registerMutation.isPending}
              onClick={openRegisterDialog}
            >
              Registrar lotes pendientes ({eligible.length})
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setExpandedKeys(new Set(drafts.map((d) => d.packageKey)))}
            >
              Expandir todos
            </Button>
          </Box>

          {registerMsg ? (
            <Alert severity={registerMsg.startsWith("✅") ? "success" : "warning"} sx={{ mb: 2 }}>
              {registerMsg}
            </Alert>
          ) : null}

          {drafts.map((draft) => (
            <DraftLotRow
              key={draft.packageKey}
              draft={draft}
              expanded={expandedKeys.has(draft.packageKey)}
              onToggle={() => toggleDraft(draft.packageKey)}
              copInput={copByPackageKey[draft.packageKey] ?? ""}
              onCopChange={(value) =>
                setCopByPackageKey((prev) => ({ ...prev, [draft.packageKey]: value }))
              }
              blueprintImages={blueprintImages}
              imagesLoading={blueprintImagesLoading}
              legacyIncomingBundles={legacyIncomingBundles}
            />
          ))}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => !registerMutation.isPending && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar registro en tránsito CardTrader</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se crearán {eligible.length} lote(s) con IDs TCGdex. Los lotes en rojo no se incluyen.
          </Typography>
          <Stack spacing={1}>
            {eligible.map((draft) => {
              const cop = suggestedCopForDraft(draft, copByPackageKey) ?? 0;
              return (
                <Paper key={draft.packageKey} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2">{draft.paidAtLabel}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {draft.totalUnits} uds · {draft.lines.length} líneas · {formatCop(cop)} COP
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={registerMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={confirmRegister}
            disabled={registerMutation.isPending || eligible.length === 0}
          >
            {registerMutation.isPending ? "Registrando…" : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
