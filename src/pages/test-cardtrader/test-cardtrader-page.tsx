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
import { formatCopRateFx } from "../../utils/purchase-currency";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import { readCtLanguage } from "../../utils/cardtrader-order-item-map";
import type { IncomingHomologItem } from "../../utils/incoming-ct0-homolog";
import {
  buildOrderTransitPackages,
  IN_TRANSIT_ORDER_STATES,
  normalizeCtOrdersResponse,
} from "../../utils/order-transit-packages";
import { fetchExpansionHomologIndex } from "../../utils/transit-card-match";
import type { Ct0UnregisteredLine, Ct0UnregisteredLot } from "../../utils/ct0-unregistered-inventory";
import {
  type IncomingBatchBundleForCt0Draft,
  pricingFieldsFromOpenIncomingBatch,
} from "../../utils/ct0-incoming-batch-draft";
import { API_INCOMING } from "../clientes/cliente-types";
import Ct0IncomingRegisterPanel from "./ct0-incoming-register-panel";
import {
  API_CARDTRADER_TRANSIT_LOTS,
  type CardtraderTransitLotRow,
} from "../cardtrader-transit/cardtrader-transit-types";

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

function SoloCardtraderCard(props: {
  line: SoloCardtraderLine;
  imageSrc?: string;
  imageLoading?: boolean;
}) {
  const { line, imageSrc, imageLoading } = props;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: "flex", gap: 1.5, bgcolor: "#fafafa" }}>
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
          {line.language} · {line.label}
          {line.orderCode ? ` · ${line.orderCode}` : ""}
        </Typography>
        {line.expansion ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {line.expansion}
          </Typography>
        ) : null}
      </Box>
      <Typography variant="body2" sx={{ alignSelf: "center" }}>
        {line.referencePrice}
      </Typography>
    </Paper>
  );
}

function Ct0UnregisteredLineCard(props: {
  line: Ct0UnregisteredLine;
  imageSrc?: string;
  imageLoading?: boolean;
}) {
  const { line, imageSrc, imageLoading } = props;
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, display: "flex", gap: 1.5, bgcolor: "#fff8e1", borderColor: "#ffb300" }}
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
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {line.qty}× {line.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {line.language} · {line.expansion}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {line.label} · {line.referencePrice}
        </Typography>
      </Box>
      <Chip size="small" color="warning" variant="outlined" label="Sin registro panel" />
    </Paper>
  );
}

function Ct0UnregisteredLotCard(props: {
  lot: Ct0UnregisteredLot;
  expanded: boolean;
  onToggle: () => void;
  blueprintImages: Record<number, string>;
  imagesLoading: boolean;
}) {
  const { lot, expanded, onToggle, blueprintImages, imagesLoading } = props;
  return (
    <Paper sx={{ mb: 2, overflow: "hidden", borderTop: 4, borderColor: "#ff8f00" }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={onToggle}
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
          <Typography variant="h6">{lot.paidAtLabel}</Typography>
          <Typography variant="body2" color="text.secondary">
            {lot.lineCount} líneas · {lot.totalUnits} uds · {lot.languages.join(", ")}
          </Typography>
        </Box>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
          {lot.lines.map((line) => (
            <Ct0UnregisteredLineCard
              key={line.lineKey}
              line={line}
              imageSrc={line.blueprintId ? blueprintImages[line.blueprintId] : undefined}
              imageLoading={imagesLoading && !!line.blueprintId && !blueprintImages[line.blueprintId]}
            />
          ))}
        </Stack>
      </Collapse>
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
            {pkg.realFxRateCop != null && pkg.realFxRateCop > 0
              ? ` · ${formatCopRateFx(pkg.realFxRateCop, pkg.cardsCostCurrency)}`
              : ""}
            {soloRegistro.length > 0 ? ` · ${soloRegistro.length} solo registro` : ""}
            {conEnvio.length > 0 ? ` · ${conEnvio.length} con envío` : ""}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          {pkg.totalCopCardsCost != null && pkg.totalCopCardsCost > 0 ? (
            <>
              <Typography variant="caption" color="text.secondary">
                COP lote (registro completo)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "success.dark" }}>
                {formatCop(pkg.totalCopCardsCost)}
              </Typography>
              {Math.abs(pkg.realCopTotal - pkg.totalCopCardsCost) > 1 ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Pendiente visible: {formatCop(pkg.realCopTotal)} ·{" "}
                  {pkg.lines.length} líneas abiertas
                </Typography>
              ) : null}
            </>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                COP pendiente (líneas visibles)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "success.dark" }}>
                {formatCop(pkg.realCopTotal)}
              </Typography>
            </>
          )}
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
  const [ct0UnregisteredOpen, setCt0UnregisteredOpen] = useState(true);
  const [expandedCt0LotKeys, setExpandedCt0LotKeys] = useState<Set<string>>(() => new Set());

  const boxQuery = useQuery<Ct0BoxItem[]>({
    queryKey: ["cardtrader", "ct0-box-items"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/ct0-box-items`);
      return Array.isArray(res.data) ? (res.data as Ct0BoxItem[]) : [];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["cardtrader", "orders", "in-transit", [...IN_TRANSIT_ORDER_STATES].join(",")],
    queryFn: async () => {
      const byId = new Map<number, ReturnType<typeof normalizeCtOrdersResponse>[number]>();
      await Promise.all(
        [...IN_TRANSIT_ORDER_STATES].map(async (state) => {
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
    totalFxCardsCost?: number;
    cardsCostCurrency?: string;
    realFxRateCop?: number;
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
            ...pricingFieldsFromOpenIncomingBatch(batch),
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

  const uniqueExpansions = useMemo(() => {
    const expansions = new Set<string>();
    for (const item of boxQuery.data ?? []) {
      if (item.expansion?.trim()) expansions.add(item.expansion.trim());
    }
    for (const order of ordersQuery.data ?? []) {
      for (const item of order.order_items ?? []) {
        if (item.expansion?.trim()) expansions.add(item.expansion.trim());
      }
    }
    return [...expansions];
  }, [boxQuery.data, ordersQuery.data]);

  const expansionHomologQuery = useQuery({
    queryKey: ["cardtrader", "expansion-homolog", uniqueExpansions.join("|")],
    enabled: uniqueExpansions.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: () =>
      fetchExpansionHomologIndex(async (expansion) => {
        const res = await axios.get(`${API_CARDTRADER}/tcgdex/resolve`, {
          params: { expansion },
        });
        return res.data as { tcgdex_set_id?: string | null };
      }, uniqueExpansions),
  });

  const consolidated = useMemo(() => {
    const bundles = incomingBundlesQuery.data ?? [];
    const orderPackages = buildOrderTransitPackages(ordersQuery.data ?? []);
    return buildBatchConsolidatedPackages({
      bundles,
      ct0Items: boxQuery.data ?? [],
      orderPackages,
      readCt0Language: (item) => readCtLanguage(item.properties),
      expansionHomolog: expansionHomologQuery.data ?? {},
    });
  }, [
    incomingBundlesQuery.data,
    boxQuery.data,
    ordersQuery.data,
    expansionHomologQuery.data,
  ]);

  const filtered = useMemo(
    () =>
      filterBatchPackagesBySearch(
        consolidated.packages,
        consolidated.soloCardtrader,
        cardSearch,
        consolidated.ct0UnregisteredLots,
      ),
    [consolidated, cardSearch],
  );

  const ct0UnregisteredUnits = filtered.ct0UnregisteredLots.reduce((s, lot) => s + lot.totalUnits, 0);

  const searchActive = cardSearch.trim().length > 0;

  useEffect(() => {
    if (!searchActive) {
      setExpandedBatchIds(new Set());
      return;
    }
    setExpandedBatchIds(new Set(filtered.packages.map((p) => p.batchId)));
    if (filtered.soloCardtrader.length > 0) setSoloSectionOpen(true);
    if (filtered.ct0UnregisteredLots.length > 0) {
      setCt0UnregisteredOpen(true);
      setExpandedCt0LotKeys(new Set(filtered.ct0UnregisteredLots.map((l) => l.lotKey)));
    }
  }, [searchActive, filtered.packages, filtered.soloCardtrader.length, filtered.ct0UnregisteredLots]);

  useEffect(() => {
    if (searchActive) return;
    if (filtered.ct0UnregisteredLots.length === 0) return;
    setExpandedCt0LotKeys(new Set(filtered.ct0UnregisteredLots.map((l) => l.lotKey)));
  }, [searchActive, filtered.ct0UnregisteredLots]);

  const blueprintIds = useMemo(() => {
    const ids = new Set<number>();
    for (const pkg of filtered.packages) {
      for (const line of pkg.lines) {
        for (const m of line.ct0Matches) ids.add(m.blueprintId);
      }
    }
    for (const lot of filtered.ct0UnregisteredLots) {
      for (const line of lot.lines) {
        if (line.blueprintId) ids.add(line.blueprintId);
      }
    }
    for (const line of filtered.soloCardtrader) {
      if (line.blueprintId) ids.add(line.blueprintId);
    }
    return [...ids];
  }, [filtered.packages, filtered.ct0UnregisteredLots, filtered.soloCardtrader]);

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
      const expansionNames = new Set<string>();
      for (const item of ct0Items) {
        if (blueprintIds.includes(item.blueprint_id) && item.expansion) {
          expansionNames.add(item.expansion);
        }
      }
      for (const line of filtered.soloCardtrader) {
        if (line.blueprintId && blueprintIds.includes(line.blueprintId) && line.expansion) {
          expansionNames.add(line.expansion);
        }
      }
      for (const lot of filtered.ct0UnregisteredLots) {
        for (const line of lot.lines) {
          if (line.blueprintId && blueprintIds.includes(line.blueprintId) && line.expansion) {
            expansionNames.add(line.expansion);
          }
        }
      }
      const expansionIds = [
        ...new Set(
          [...expansionNames]
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

  const incomingBundlesForRegister = useMemo((): IncomingBatchBundleForCt0Draft[] => {
    return (incomingBundlesQuery.data ?? []).map((bundle) => ({
      batchId: bundle.batchId,
      purchaseDate: bundle.purchaseDate,
      totalCopCardsCost: bundle.totalCopCardsCost,
      totalFxCardsCost: bundle.totalFxCardsCost,
      cardsCostCurrency: bundle.cardsCostCurrency,
      realFxRateCop: bundle.realFxRateCop,
      items: bundle.items.map((it) => ({
        card_name: it.card_name,
        quantity_ordered: it.quantity_ordered,
        remaining_quantity: it.remaining_quantity,
        unit_cost_cop: it.unit_cost_cop,
        eur_unit_price: it.eur_unit_price,
      })),
    }));
  }, [incomingBundlesQuery.data]);

  const transitLotsQuery = useQuery<CardtraderTransitLotRow[]>({
    queryKey: ["cardtrader-transit-lots-open"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER_TRANSIT_LOTS}/open`);
      return Array.isArray(res.data) ? (res.data as CardtraderTransitLotRow[]) : [];
    },
    staleTime: 60 * 1000,
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
    ordersQuery.isLoading ||
    incomingOpenQuery.isLoading ||
    ((incomingOpenQuery.data?.length ?? 0) > 0 && incomingBundlesQuery.isLoading) ||
    (uniqueExpansions.length > 0 && expansionHomologQuery.isLoading);

  const toggleBatch = (batchId: string) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const totalCopVisible = filtered.packages.reduce((s, p) => s + p.realCopTotal, 0);
  const totalCopLotes = filtered.packages.reduce(
    (s, p) => s + (p.totalCopCardsCost != null && p.totalCopCardsCost > 0 ? p.totalCopCardsCost : p.realCopTotal),
    0,
  );

  return (
    <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Consolidado tránsito
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        1) Lote desde tu registro · 2) Cruce CT Zero (toda la API) · 3) Pedidos en camino por
        nombre y precio · Rojo = solo tu registro · Al final = solo CardTrader.
      </Typography>

      <Ct0IncomingRegisterPanel
        ct0Items={boxQuery.data ?? []}
        existingTransitLots={existingTransitLots}
        legacyIncomingBundles={incomingBundlesForRegister}
        loading={
          boxQuery.isLoading ||
          incomingOpenQuery.isLoading ||
          incomingBundlesQuery.isLoading ||
          transitLotsQuery.isLoading
        }
      />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Chip label="Tu registro = base del lote" />
        <Chip color="error" variant="outlined" label="Rojo = solo tu registro" />
        <Chip color="info" variant="outlined" label="Azul = match envío" />
        <Chip color="warning" variant="outlined" label="Ámbar = CT Zero JP/ZH sin registro" />
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
          <Typography variant="h5">{formatCop(totalCopLotes)}</Typography>
          <Typography variant="caption">COP lotes (registro completo)</Typography>
          {Math.abs(totalCopLotes - totalCopVisible) > 1 ? (
            <Typography variant="caption" color="text.secondary" display="block">
              Visible: {formatCop(totalCopVisible)}
            </Typography>
          ) : null}
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#ff8f00" }}>
          <Typography variant="h5">{ct0UnregisteredUnits}</Typography>
          <Typography variant="caption">CT Zero JP/ZH sin panel</Typography>
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

          {filtered.ct0UnregisteredLots.length > 0 ? (
            <Paper sx={{ mt: 3, overflow: "hidden", borderTop: 4, borderColor: "#ff8f00" }}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setCt0UnregisteredOpen((v) => !v)}
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  cursor: "pointer",
                  bgcolor: "#fff8e1",
                  "&:hover": { bgcolor: "#ffecb3" },
                }}
              >
                <IconButton
                  size="small"
                  sx={{
                    transform: ct0UnregisteredOpen ? "rotate(180deg)" : "none",
                    transition: "0.2s",
                  }}
                >
                  ▼
                </IconButton>
                <Box>
                  <Typography variant="h6">CT Zero — japonés / chino sin registro</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {filtered.ct0UnregisteredLots.length} lotes · {ct0UnregisteredUnits} uds en hub
                    (no están en tu panel a propósito)
                  </Typography>
                </Box>
              </Box>
              <Collapse in={ct0UnregisteredOpen} unmountOnExit>
                <Box sx={{ px: 2, pb: 2, pt: 1 }}>
                  {filtered.ct0UnregisteredLots.map((lot) => (
                    <Ct0UnregisteredLotCard
                      key={lot.lotKey}
                      lot={lot}
                      expanded={expandedCt0LotKeys.has(lot.lotKey)}
                      onToggle={() =>
                        setExpandedCt0LotKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(lot.lotKey)) next.delete(lot.lotKey);
                          else next.add(lot.lotKey);
                          return next;
                        })
                      }
                      blueprintImages={blueprintImagesQuery.data ?? {}}
                      imagesLoading={blueprintImagesQuery.isFetching}
                    />
                  ))}
                </Box>
              </Collapse>
            </Paper>
          ) : null}

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
                    <SoloCardtraderCard
                      key={line.lineKey}
                      line={line}
                      imageSrc={
                        line.blueprintId
                          ? (blueprintImagesQuery.data ?? {})[line.blueprintId]
                          : undefined
                      }
                      imageLoading={
                        blueprintImagesQuery.isFetching &&
                        !!line.blueprintId &&
                        !(blueprintImagesQuery.data ?? {})[line.blueprintId]
                      }
                    />
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
