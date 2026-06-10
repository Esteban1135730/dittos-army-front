import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiBase, apiUrl } from "../../config/api";
import {
  buildBatchConsolidatedPackages,
  filterBatchPackagesBySearch,
  groupBatchConsolidatedLines,
  type BatchConsolidatedLine,
  type BatchConsolidatedPackage,
  type SoloCardtraderLine,
} from "../../utils/batch-consolidated-package";
import {
  buildBlueprintImageUrlMapFromExport,
  normalizeCtExpansions,
  resolveCtExpansionId,
} from "../../utils/cardtrader-blueprint-image";
import { getPedidoBlueprintImageDisplaySrc } from "../../utils/cardtrader-pedido-blueprint-image-cache";
import { formatCop } from "../../utils/cardtrader-order-pricing";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import { readCtLanguage } from "../../utils/cardtrader-order-item-map";
import type { IncomingHomologItem } from "../../utils/incoming-ct0-homolog";
import {
  buildOrderTransitPackages,
  normalizeCtOrdersResponse,
} from "../../utils/order-transit-packages";
import { API_INCOMING } from "../clientes/cliente-types";

const API_CARDTRADER = apiUrl("/cardtrader");

function BatchLineCard(props: {
  line: BatchConsolidatedLine;
  ct0ImageSrc?: string;
  imageLoading?: boolean;
}) {
  const { line, ct0ImageSrc, imageLoading } = props;
  const isSoloRegistro = line.panelOnlyUnits === line.qty;
  const hasEnvioMatch = line.orderUnits > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        bgcolor: hasEnvioMatch ? "#e3f2fd" : isSoloRegistro ? "#ffebee" : "#ffffff",
        borderColor: hasEnvioMatch ? "#1565c0" : isSoloRegistro ? "#c62828" : "#e0e0e0",
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
        ) : ct0ImageSrc || line.imageUrl ? (
          <Box
            component="img"
            src={ct0ImageSrc || line.imageUrl}
            alt={line.cardName}
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
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {line.qty}× {line.cardName}
          </Typography>
          {isSoloRegistro ? <Chip size="small" color="error" label="Solo tu registro" /> : null}
          {hasEnvioMatch ? <Chip size="small" color="info" label="Match envío" /> : null}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {line.language}
          {line.rareza ? ` · ${line.rareza}` : ""} · {line.cardId}
        </Typography>
        {line.eurUnitPrice != null ? (
          <Typography variant="caption" color="text.secondary" display="block">
            Ref. panel €{line.eurUnitPrice.toFixed(2)}/ud
          </Typography>
        ) : null}

        {line.ct0Matches.length > 0 ? (
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {line.ct0Matches.map((m) => (
              <Chip
                key={`ct0-${m.ct0ItemId}`}
                size="small"
                color="primary"
                variant="outlined"
                label={`CT Zero ×${m.qty} · ${m.stateLabels.join(", ")}`}
              />
            ))}
          </Box>
        ) : null}

        {line.orderMatches.length > 0 ? (
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {line.orderMatches.map((m) => (
              <Chip
                key={m.lineKey}
                size="small"
                color="info"
                variant="outlined"
                label={`${m.orderState} ×${m.qty} · ${m.orderCode}`}
              />
            ))}
          </Box>
        ) : null}

        {isSoloRegistro ? (
          <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
            Sin match en CardTrader
          </Typography>
        ) : line.panelOnlyUnits > 0 ? (
          <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
            {line.panelOnlyUnits} ud sin match en CardTrader
          </Typography>
        ) : null}
      </Box>

      <Box sx={{ textAlign: "right", minWidth: 100 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatCop(line.unitCostCop)}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          / ud · {formatCop(line.lineCostCop)}
        </Typography>
      </Box>
    </Paper>
  );
}

function SoloCardtraderCard(props: { line: SoloCardtraderLine }) {
  const { line } = props;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: "flex", gap: 1.5, bgcolor: "#fafafa" }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {line.qty}× {line.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {line.language} · {line.label}
          {line.orderCode ? ` · ${line.orderCode}` : ""}
        </Typography>
      </Box>
      <Typography variant="body2">{line.referencePrice}</Typography>
    </Paper>
  );
}

function BatchLineList(props: {
  lines: BatchConsolidatedLine[];
  blueprintImages: Record<number, string>;
  imagesLoading: boolean;
}) {
  const { lines, blueprintImages, imagesLoading } = props;
  if (lines.length === 0) return null;

  return (
    <Stack spacing={1.5}>
      {lines.map((line) => {
        const bpId = line.ct0Matches[0]?.blueprintId;
        return (
          <BatchLineCard
            key={line.batchItemId}
            line={line}
            ct0ImageSrc={bpId ? blueprintImages[bpId] : undefined}
            imageLoading={imagesLoading && !!bpId && !blueprintImages[bpId]}
          />
        );
      })}
    </Stack>
  );
}

function BatchPackageCard(props: {
  pkg: BatchConsolidatedPackage;
  expanded: boolean;
  onToggle: () => void;
  blueprintImages: Record<number, string>;
  imagesLoading: boolean;
}) {
  const { pkg, expanded, onToggle, blueprintImages, imagesLoading } = props;
  const title = new Date(pkg.purchaseDate).toLocaleDateString("es-CO", { dateStyle: "long" });
  const { soloRegistro, conEnvio, otras } = groupBatchConsolidatedLines(pkg.lines);

  return (
    <Paper sx={{ mb: 2, borderTop: 4, borderColor: "#1565c0", overflow: "hidden" }}>
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
          display: "flex",
          gap: 1,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <IconButton
          size="small"
          sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
        >
          ▼
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {pkg.lines.length} líneas · {pkg.totalUnits} uds
            {soloRegistro.length > 0 ? ` · ${soloRegistro.length} solo registro` : ""}
            {conEnvio.length > 0 ? ` · ${conEnvio.length} con envío` : ""}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" color="text.secondary">
            COP registro
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "success.dark" }}>
            {formatCop(pkg.realCopTotal)}
          </Typography>
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            component={RouterLink}
            to={`/incoming/batch/${pkg.batchId}`}
            size="small"
            sx={{ mb: 2 }}
          >
            Ver lote en panel
          </Button>
          <Stack spacing={2}>
            {soloRegistro.length > 0 ? (
              <Box>
                <Typography variant="overline" color="error.main" sx={{ fontWeight: 700 }}>
                  Solo tu registro ({soloRegistro.length})
                </Typography>
                <BatchLineList
                  lines={soloRegistro}
                  blueprintImages={blueprintImages}
                  imagesLoading={imagesLoading}
                />
              </Box>
            ) : null}
            {conEnvio.length > 0 ? (
              <Box>
                <Typography variant="overline" color="info.main" sx={{ fontWeight: 700 }}>
                  Match envío ({conEnvio.length})
                </Typography>
                <BatchLineList
                  lines={conEnvio}
                  blueprintImages={blueprintImages}
                  imagesLoading={imagesLoading}
                />
              </Box>
            ) : null}
            {otras.length > 0 ? (
              <Box>
                {soloRegistro.length > 0 || conEnvio.length > 0 ? (
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    CT Zero / otras ({otras.length})
                  </Typography>
                ) : null}
                <BatchLineList
                  lines={otras}
                  blueprintImages={blueprintImages}
                  imagesLoading={imagesLoading}
                />
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function TestCardtraderPage() {
  const [cardSearch, setCardSearch] = useState("");
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(() => new Set());
  const [soloSectionOpen, setSoloSectionOpen] = useState(false);

  const boxQuery = useQuery<Ct0BoxItem[]>({
    queryKey: ["cardtrader", "ct0-box-items"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/ct0-box-items`);
      return Array.isArray(res.data) ? (res.data as Ct0BoxItem[]) : [];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["cardtrader", "orders", "in-transit"],
    queryFn: async () => {
      const states = ["paid", "sent", "done"] as const;
      const byId = new Map<number, ReturnType<typeof normalizeCtOrdersResponse>[number]>();
      await Promise.all(
        states.map(async (state) => {
          const res = await axios.get(`${API_CARDTRADER}/orders`, {
            params: { state, order_as: "buyer", limit: 100 },
          });
          for (const o of normalizeCtOrdersResponse(res.data)) byId.set(o.id, o);
        }),
      );
      return [...byId.values()];
    },
    staleTime: 5 * 60 * 1000,
  });

  const incomingOpenQuery = useQuery<
    { batch_id: string; purchase_date: string; total_cop_cards_cost?: number }[]
  >({
    queryKey: ["incoming-batch-open-homolog"],
    queryFn: async () => {
      const res = await axios.get(`${API_INCOMING}/batch/open`);
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60 * 1000,
  });

  type IncomingBatchBundle = {
    batchId: string;
    purchaseDate: string;
    totalCopCardsCost?: number;
    items: IncomingHomologItem[];
  };

  const incomingBundlesQuery = useQuery<IncomingBatchBundle[]>({
    queryKey: [
      "incoming-batch-bundles",
      (incomingOpenQuery.data ?? []).map((b) => b.batch_id).join(","),
    ],
    enabled: (incomingOpenQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const batches = incomingOpenQuery.data ?? [];
      return Promise.all(
        batches.map(async (batch) => {
          const res = await axios.get(`${API_INCOMING}/batch/${batch.batch_id}/items`);
          const items = Array.isArray(res.data) ? res.data : [];
          return {
            batchId: batch.batch_id,
            purchaseDate: batch.purchase_date,
            totalCopCardsCost: batch.total_cop_cards_cost,
            items: items.map(
              (it: {
                batch_item_id: string;
                card_id: string;
                card_name: string;
                language: string;
                quantity_ordered: number;
                remaining_quantity: number;
                unit_cost_cop: number;
                eur_unit_price?: number;
                image_url?: string;
                rareza?: string | null;
              }) => ({
                batch_item_id: it.batch_item_id,
                card_id: it.card_id,
                card_name: it.card_name,
                language: it.language,
                quantity_ordered: it.quantity_ordered,
                remaining_quantity: it.remaining_quantity,
                unit_cost_cop: it.unit_cost_cop,
                eur_unit_price: it.eur_unit_price,
                image_url: it.image_url,
                rareza: it.rareza,
              }),
            ),
          };
        }),
      );
    },
  });

  const consolidated = useMemo(() => {
    const bundles = incomingBundlesQuery.data ?? [];
    const orderPackages = buildOrderTransitPackages(ordersQuery.data ?? []);
    return buildBatchConsolidatedPackages({
      bundles,
      ct0Items: boxQuery.data ?? [],
      orderPackages,
      readCt0Language: (item) => readCtLanguage(item.properties),
    });
  }, [incomingBundlesQuery.data, boxQuery.data, ordersQuery.data]);

  const filtered = useMemo(
    () => filterBatchPackagesBySearch(consolidated.packages, consolidated.soloCardtrader, cardSearch),
    [consolidated, cardSearch],
  );

  const searchActive = cardSearch.trim().length > 0;

  useEffect(() => {
    if (!searchActive) {
      setExpandedBatchIds(new Set());
      return;
    }
    setExpandedBatchIds(new Set(filtered.packages.map((p) => p.batchId)));
    if (filtered.soloCardtrader.length > 0) setSoloSectionOpen(true);
  }, [searchActive, filtered.packages, filtered.soloCardtrader.length]);

  const blueprintIds = useMemo(() => {
    const ids = new Set<number>();
    for (const pkg of filtered.packages) {
      for (const line of pkg.lines) {
        for (const m of line.ct0Matches) ids.add(m.blueprintId);
      }
    }
    return [...ids];
  }, [filtered.packages]);

  const expansionsQuery = useQuery({
    queryKey: ["cardtrader", "expansions", "pokemon"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/expansions`, { params: { game_id: 5 } });
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  const blueprintImagesQuery = useQuery<Record<number, string>>({
    queryKey: ["batch-consolidated-bp-images", blueprintIds.join(",")],
    enabled: expansionsQuery.isSuccess && blueprintIds.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const expansions = normalizeCtExpansions(expansionsQuery.data);
      const ct0Items = boxQuery.data ?? [];
      const expansionNames = [
        ...new Set(
          ct0Items
            .filter((i) => blueprintIds.includes(i.blueprint_id))
            .map((i) => i.expansion)
            .filter(Boolean),
        ),
      ];
      const expansionIds = [
        ...new Set(
          expansionNames
            .map((name) => resolveCtExpansionId(expansions, name))
            .filter((id): id is number => id != null),
        ),
      ];

      const imageUrlByBlueprint = new Map<number, string>();
      await Promise.all(
        expansionIds.map(async (expansionId) => {
          try {
            const res = await axios.get(`${API_CARDTRADER}/blueprints`, {
              params: { expansion_id: expansionId },
            });
            for (const [bpId, url] of buildBlueprintImageUrlMapFromExport(res.data)) {
              imageUrlByBlueprint.set(bpId, url);
            }
          } catch {
            /* skip */
          }
        }),
      );

      const out: Record<number, string> = {};
      for (const bpId of blueprintIds) {
        const src = getPedidoBlueprintImageDisplaySrc(
          bpId,
          imageUrlByBlueprint.get(bpId),
          apiBase(),
        );
        if (src) out[bpId] = src;
      }
      return out;
    },
  });

  const loading =
    boxQuery.isLoading ||
    ordersQuery.isLoading ||
    incomingOpenQuery.isLoading ||
    ((incomingOpenQuery.data?.length ?? 0) > 0 && incomingBundlesQuery.isLoading);

  const toggleBatch = (batchId: string) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const totalCop = filtered.packages.reduce((s, p) => s + p.realCopTotal, 0);

  return (
    <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Consolidado tránsito
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        1) Lote desde tu registro · 2) Cruce CT Zero (toda la API) · 3) Pedidos en camino por
        nombre y precio · Rojo = solo tu registro · Al final = solo CardTrader.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Demo: no modifica datos existentes.
      </Alert>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Chip label="Tu registro = base del lote" />
        <Chip color="error" variant="outlined" label="Rojo = solo tu registro" />
        <Chip color="info" variant="outlined" label="Azul = match envío" />
        <Chip color="primary" variant="outlined" label="CT Zero = match hub" />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 2,
          mb: 2,
        }}
      >
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#37474f" }}>
          <Typography variant="h5">{filtered.packages.length}</Typography>
          <Typography variant="caption">Lotes</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#1565c0" }}>
          <Typography variant="h5">{boxQuery.data?.length ?? 0}</Typography>
          <Typography variant="caption">Filas CT Zero API</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#ffca28" }}>
          <Typography variant="h5">{formatCop(totalCop)}</Typography>
          <Typography variant="caption">COP registro (visible)</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#546e7a" }}>
          <Typography variant="h5">{filtered.soloCardtrader.length}</Typography>
          <Typography variant="caption">Solo CardTrader</Typography>
        </Paper>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 4 }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Cargando…</Typography>
        </Box>
      ) : (
        <>
          <TextField
            fullWidth
            size="small"
            label="Buscar carta"
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            sx={{ mb: 2, maxWidth: 480 }}
          />

          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Lotes ({filtered.packages.length})
          </Typography>

          {filtered.packages.length === 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No hay lotes abiertos con cartas pendientes.
            </Alert>
          ) : (
            filtered.packages.map((pkg) => (
              <BatchPackageCard
                key={pkg.batchId}
                pkg={pkg}
                expanded={expandedBatchIds.has(pkg.batchId)}
                onToggle={() => toggleBatch(pkg.batchId)}
                blueprintImages={blueprintImagesQuery.data ?? {}}
                imagesLoading={blueprintImagesQuery.isFetching}
              />
            ))
          )}

          {filtered.soloCardtrader.length > 0 ? (
            <Paper sx={{ mt: 3, overflow: "hidden", borderTop: 4, borderColor: "#546e7a" }}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setSoloSectionOpen((v) => !v)}
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <IconButton
                  size="small"
                  sx={{ transform: soloSectionOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}
                >
                  ▼
                </IconButton>
                <Box>
                  <Typography variant="h6">Solo CardTrader</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {filtered.soloCardtrader.length} líneas sin match en tu registro
                  </Typography>
                </Box>
              </Box>
              <Collapse in={soloSectionOpen} unmountOnExit>
                <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
                  {filtered.soloCardtrader.map((line) => (
                    <SoloCardtraderCard key={line.lineKey} line={line} />
                  ))}
                </Stack>
              </Collapse>
            </Paper>
          ) : null}
        </>
      )}
    </Box>
  );
}
