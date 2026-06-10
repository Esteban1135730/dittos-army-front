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
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiBase, apiUrl } from "../../config/api";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import type { Ct0BoxItem } from "../../utils/cardtrader-ct0-box";
import {
  buildBlueprintImageUrlMapFromExport,
  normalizeCtExpansions,
  resolveCtExpansionId,
} from "../../utils/cardtrader-blueprint-image";
import { getPedidoBlueprintImageDisplaySrc } from "../../utils/cardtrader-pedido-blueprint-image-cache";
import { formatCop, formatRateCopPerUnit } from "../../utils/cardtrader-order-pricing";
import {
  inferOperationalRarezaFromCtProperties,
  readCtCondition,
  readCtLanguage,
} from "../../utils/cardtrader-order-item-map";
import {
  buildConsolidatedTransitLots,
  filterConsolidatedTransitLots,
  type ConsolidatedTransitLot,
} from "../../utils/consolidated-transit-lots";
import {
  buildCt0HomologIndex,
  buildPanelOnlyLines,
  computeSuggestedCopFromBatchItems,
  homologateIncomingItems,
  summarizeIncomingHomolog,
  type IncomingHomologItem,
  type IncomingPanelLine,
} from "../../utils/incoming-ct0-homolog";
import {
  buildCt0PackageProfile,
  buildIncomingBatchProfile,
  matchCt0PackagesToIncomingBatches,
  matchMapByCt0PackageKey,
} from "../../utils/incoming-ct0-package-match";
import {
  buildPurchasePackages,
  locationLabel,
  type PurchasePackageLine,
} from "../../utils/purchase-package-consolidated";
import { API_INCOMING } from "../clientes/cliente-types";

const API_CARDTRADER = apiUrl("/cardtrader");

function parseCopInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function variantLabelFromProps(props: Record<string, unknown> | undefined): string {
  return operationalRarezaLabel(inferOperationalRarezaFromCtProperties(props));
}

function Ct0LineCard(props: {
  line: PurchasePackageLine;
  imageSrc?: string;
  imageLoading?: boolean;
}) {
  const { line, imageSrc, imageLoading } = props;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
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
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
            onError={(ev) => {
              (ev.target as HTMLImageElement).style.display = "none";
            }}
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
            {line.qty}× {line.name}
          </Typography>
          <Chip size="small" label={locationLabel(line.location)} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
          {line.condition} · {line.language} · {line.variantLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {line.expansion}
        </Typography>
      </Box>

      <Box sx={{ textAlign: "right", minWidth: 100 }}>
        <Typography variant="body2">{line.referencePrice}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Ref. CT
        </Typography>
        {line.unitCostCop != null ? (
          <>
            <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
              {formatCop(line.unitCostCop)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              / ud · {line.lineCostCop != null ? formatCop(line.lineCostCop) : "—"} línea
            </Typography>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
            Sin COP en panel
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function PanelLineCard(props: { line: IncomingPanelLine }) {
  const { line } = props;
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        bgcolor: "#fff8e1",
        borderColor: "#ffca28",
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
        {line.imageUrl ? (
          <Box
            component="img"
            src={line.imageUrl}
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
          <Chip size="small" color="warning" label="Solo tu registro" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {line.language}
          {line.rareza ? ` · ${line.rareza}` : ""} · {line.cardId}
        </Typography>
        {line.eurUnitPrice != null ? (
          <Typography variant="caption" color="text.secondary" display="block">
            Ref. €{line.eurUnitPrice.toFixed(2)}/ud
          </Typography>
        ) : null}
      </Box>

      <Box sx={{ textAlign: "right", minWidth: 100 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatCop(line.unitCostCop)}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          / ud · {formatCop(line.lineCostCop)} línea
        </Typography>
      </Box>
    </Paper>
  );
}

function useLotBlueprintImages(lot: ConsolidatedTransitLot | null, enabled: boolean) {
  const ctLines = useMemo(
    () => (lot ? lot.ctPackages.flatMap((p) => p.lines) : []),
    [lot],
  );
  const expansionNames = useMemo(
    () => [...new Set(ctLines.map((l) => l.expansion).filter(Boolean))],
    [ctLines],
  );

  const expansionsQuery = useQuery({
    queryKey: ["cardtrader", "expansions", "pokemon"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/expansions`, {
        params: { game_id: 5 },
      });
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  return useQuery<Record<number, string>>({
    queryKey: ["ct0-blueprint-images", lot?.lotKey, expansionNames.join("|")],
    enabled: enabled && !!lot && ctLines.length > 0 && expansionsQuery.isSuccess && expansionNames.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const expansions = normalizeCtExpansions(expansionsQuery.data);
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
            /* expansión sin export */
          }
        }),
      );

      const out: Record<number, string> = {};
      for (const line of ctLines) {
        const bpId = line.blueprintId;
        if (out[bpId]) continue;
        const imageUrl = imageUrlByBlueprint.get(bpId);
        const src = getPedidoBlueprintImageDisplaySrc(bpId, imageUrl, apiBase());
        if (src) out[bpId] = src;
      }
      return out;
    },
  });
}

function ConsolidatedLotCard(props: {
  lot: ConsolidatedTransitLot;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { lot, expanded, onToggle } = props;
  const blueprintImagesQuery = useLotBlueprintImages(lot, expanded);

  const title =
    lot.kind === "batch" || lot.kind === "panel-only"
      ? lot.batchPurchaseDate
        ? new Date(lot.batchPurchaseDate).toLocaleDateString("es-CO", {
            dateStyle: "long",
          })
        : "Compra en camino"
      : lot.ctPackages[0]?.paidAtLabel ?? "Checkout CT";

  const subtitleParts: string[] = [];
  if (lot.ctPackages.length > 0) {
    subtitleParts.push(
      `${lot.ctPackages.length} pago${lot.ctPackages.length > 1 ? "s" : ""} CT · ${lot.ctSubtotalUsd.toFixed(2)} USD ref.`,
    );
  }
  if (lot.panelOnlyLines.length > 0) {
    subtitleParts.push(
      `${lot.panelOnlyLines.reduce((s, l) => s + l.qty, 0)} uds solo en tu registro`,
    );
  }
  subtitleParts.push(`${lot.totalUnits} cartas en total`);

  return (
    <Paper
      sx={{
        mb: 2,
        borderTop: 4,
        borderColor: lot.batchId ? "#1565c0" : "#546e7a",
        overflow: "hidden",
      }}
    >
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
          flexWrap: "wrap",
          gap: 2,
          alignItems: "flex-start",
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <IconButton
          size="small"
          aria-label={expanded ? "Contraer lote" : "Expandir lote"}
          sx={{ mt: 0.25, transform: expanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          ▼
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitleParts.join(" · ")}
          </Typography>
          {lot.ctMatches.length > 0 ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Match panel:{" "}
              {lot.ctMatches
                .map((m) => `${Math.round(m.nameOverlapRatio * 100)}% (${m.ct0PaidAt.slice(0, 10)})`)
                .join(" · ")}
            </Typography>
          ) : null}
        </Box>

        <Box sx={{ textAlign: { xs: "left", sm: "right" }, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Compra real (COP)
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "success.dark" }}>
            {formatCop(lot.realCopTotal)}
          </Typography>
          {lot.batchTotalCopCardsCost != null &&
          lot.batchTotalCopCardsCost !== lot.realCopTotal ? (
            <Typography variant="caption" color="text.secondary" display="block">
              Registro panel: {formatCop(lot.batchTotalCopCardsCost)}
            </Typography>
          ) : null}
          {lot.ctSubtotalUsd > 0 && lot.realCopTotal > 0 ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Tasa ref.:{" "}
              {formatRateCopPerUnit(lot.realCopTotal / lot.ctSubtotalUsd, "USD")}
            </Typography>
          ) : null}
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 2 }}>
          {lot.batchId ? (
            <Button
              component={RouterLink}
              to={`/incoming/batch/${lot.batchId}`}
              size="small"
              sx={{ mb: 2 }}
              onClick={(e) => e.stopPropagation()}
            >
              Ver lote en panel
            </Button>
          ) : null}

          {lot.ctPackages.length > 0 ? (
        <>
          {lot.ctPackages.map((pkg) => (
            <Box key={pkg.packageKey} sx={{ mb: 2 }}>
              {lot.ctPackages.length > 1 ? (
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Pago CT · {pkg.paidAtLabel} · {pkg.units} cartas
                </Typography>
              ) : null}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                {pkg.locations.map((loc) => (
                  <Chip key={`${pkg.packageKey}-${loc}`} size="small" label={locationLabel(loc)} />
                ))}
              </Box>
              <Stack spacing={1.5}>
                {pkg.lines.map((line) => (
                  <Ct0LineCard
                    key={line.lineKey}
                    line={line}
                    imageSrc={blueprintImagesQuery.data?.[line.blueprintId]}
                    imageLoading={
                      blueprintImagesQuery.isFetching &&
                      !blueprintImagesQuery.data?.[line.blueprintId]
                    }
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </>
      ) : null}

      {lot.panelOnlyLines.length > 0 ? (
        <>
          {lot.ctPackages.length > 0 ? (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                En tu registro, aún no en CardTrader
              </Typography>
            </>
          ) : null}
          <Stack spacing={1.5}>
            {lot.panelOnlyLines.map((line) => (
              <PanelLineCard key={line.batchItemId} line={line} />
            ))}
          </Stack>
        </>
      ) : null}

      {blueprintImagesQuery.isFetching && lot.ctPackages.length > 0 ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Cargando imágenes CT…
          </Typography>
        </Box>
      ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function TestCardtraderPage() {
  const [copByPackage] = useState<Record<string, string>>({});
  const [cardSearch, setCardSearch] = useState("");
  const [expandedLotKeys, setExpandedLotKeys] = useState<Set<string>>(() => new Set());

  const boxQuery = useQuery<Ct0BoxItem[]>({
    queryKey: ["cardtrader", "ct0-box-items"],
    queryFn: async () => {
      const res = await axios.get(`${API_CARDTRADER}/ct0-box-items`);
      return Array.isArray(res.data) ? (res.data as Ct0BoxItem[]) : [];
    },
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

  const incomingItemsFlat = useMemo(
    () => (incomingBundlesQuery.data ?? []).flatMap((b) => b.items),
    [incomingBundlesQuery.data],
  );

  const panelHomolog = useMemo(() => {
    const index = buildCt0HomologIndex({
      ct0Items: boxQuery.data ?? [],
      readLanguage: readCtLanguage,
      readRareza: (props) => inferOperationalRarezaFromCtProperties(props),
    });
    const homologByItemId = homologateIncomingItems(incomingItemsFlat, index);
    const bundles = incomingBundlesQuery.data ?? [];
    const panelOnlyLines = buildPanelOnlyLines(bundles, homologByItemId);
    const summary = summarizeIncomingHomolog(homologByItemId.values(), index.ct0UnitsTotal);
    return { panelOnlyLines, summary };
  }, [boxQuery.data, incomingItemsFlat, incomingBundlesQuery.data]);

  const basePackagesResult = useMemo(
    () =>
      buildPurchasePackages({
        ct0Items: boxQuery.data ?? [],
        copByPackageKey: {},
        parseCop: parseCopInput,
        readCondition: readCtCondition,
        readLanguage: readCtLanguage,
        variantLabel: variantLabelFromProps,
      }),
    [boxQuery.data],
  );

  const allPackageMatches = useMemo(() => {
    const batchProfiles = (incomingBundlesQuery.data ?? []).map((b) =>
      buildIncomingBatchProfile(
        b.batchId,
        b.purchaseDate,
        b.items.map((it) => ({
          card_name: it.card_name,
          quantity_ordered: it.quantity_ordered,
          remaining_quantity: it.remaining_quantity,
        })),
      ),
    );
    const ctProfiles = basePackagesResult.packages.map(buildCt0PackageProfile);
    return matchCt0PackagesToIncomingBatches(ctProfiles, batchProfiles);
  }, [basePackagesResult.packages, incomingBundlesQuery.data]);

  const packageMatchByKey = useMemo(
    () => matchMapByCt0PackageKey(allPackageMatches),
    [allPackageMatches],
  );

  const suggestedCopByPackage = useMemo(() => {
    const out: Record<string, number> = {};
    const bundles = incomingBundlesQuery.data ?? [];
    for (const pkg of basePackagesResult.packages) {
      const match = packageMatchByKey.get(pkg.packageKey);
      if (!match) continue;
      const bundle = bundles.find((b) => b.batchId === match.batchId);
      if (!bundle) continue;
      const cop = computeSuggestedCopFromBatchItems(pkg.lines, bundle.items);
      if (cop != null) out[pkg.packageKey] = cop;
    }
    return out;
  }, [basePackagesResult.packages, packageMatchByKey, incomingBundlesQuery.data]);

  const effectiveCopByPackage = useMemo(() => {
    const out: Record<string, string> = { ...copByPackage };
    for (const [key, cop] of Object.entries(suggestedCopByPackage)) {
      if (!out[key]?.trim()) out[key] = String(cop);
    }
    return out;
  }, [copByPackage, suggestedCopByPackage]);

  const batchItemsByPackageKey = useMemo(() => {
    const out: Record<string, IncomingHomologItem[]> = {};
    const bundles = incomingBundlesQuery.data ?? [];
    for (const [key, match] of packageMatchByKey) {
      const bundle = bundles.find((b) => b.batchId === match.batchId);
      if (bundle) out[key] = bundle.items;
    }
    return out;
  }, [packageMatchByKey, incomingBundlesQuery.data]);

  const { packages, summary } = useMemo(
    () =>
      buildPurchasePackages({
        ct0Items: boxQuery.data ?? [],
        copByPackageKey: effectiveCopByPackage,
        batchItemsByPackageKey,
        parseCop: parseCopInput,
        readCondition: readCtCondition,
        readLanguage: readCtLanguage,
        variantLabel: variantLabelFromProps,
      }),
    [boxQuery.data, effectiveCopByPackage, batchItemsByPackageKey],
  );

  const consolidatedLots = useMemo(
    () =>
      buildConsolidatedTransitLots({
        packages,
        bundles: (incomingBundlesQuery.data ?? []).map((b) => ({
          batchId: b.batchId,
          purchaseDate: b.purchaseDate,
          totalCopCardsCost: b.totalCopCardsCost,
        })),
        panelOnlyLinesAll: panelHomolog.panelOnlyLines,
        allMatches: allPackageMatches,
      }),
    [packages, incomingBundlesQuery.data, panelHomolog.panelOnlyLines, allPackageMatches],
  );

  const lotsSummary = useMemo(() => {
    const realCopTotal = consolidatedLots.reduce((s, l) => s + l.realCopTotal, 0);
    const panelOnlyUnits = consolidatedLots.reduce(
      (s, l) => s + l.panelOnlyLines.reduce((a, p) => a + p.qty, 0),
      0,
    );
    return { realCopTotal, panelOnlyUnits, lotCount: consolidatedLots.length };
  }, [consolidatedLots]);

  const filteredLots = useMemo(
    () => filterConsolidatedTransitLots(consolidatedLots, cardSearch),
    [consolidatedLots, cardSearch],
  );

  const searchActive = cardSearch.trim().length > 0;

  const visibleCardCount = useMemo(
    () => filteredLots.reduce((s, l) => s + l.totalUnits, 0),
    [filteredLots],
  );

  useEffect(() => {
    if (!searchActive) {
      setExpandedLotKeys(new Set());
      return;
    }
    setExpandedLotKeys(new Set(filteredLots.map((l) => l.lotKey)));
  }, [searchActive, filteredLots]);

  const toggleLot = (lotKey: string) => {
    setExpandedLotKeys((prev) => {
      const next = new Set(prev);
      if (next.has(lotKey)) next.delete(lotKey);
      else next.add(lotKey);
      return next;
    });
  };

  const loading =
    boxQuery.isLoading ||
    incomingOpenQuery.isLoading ||
    ((incomingOpenQuery.data?.length ?? 0) > 0 && incomingBundlesQuery.isLoading);

  return (
    <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Consolidado tránsito
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cada lote muestra las cartas de CardTrader y, en amarillo dentro de la misma caja, las que
        solo están en tu registro. El total COP suma ambas fuentes con los precios del panel.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Demo: no modifica datos existentes.
      </Alert>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 2,
          mb: 3,
        }}
      >
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#37474f" }}>
          <Typography variant="h5">{lotsSummary.lotCount}</Typography>
          <Typography variant="caption">Lotes consolidados</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#1565c0" }}>
          <Typography variant="h5">{summary.ct0HubUnits}</Typography>
          <Typography variant="caption">En hub CT</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#2e7d32" }}>
          <Typography variant="h5">{summary.ct0ReadyUnits}</Typography>
          <Typography variant="caption">Listas CT</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#546e7a" }}>
          <Typography variant="h5">${summary.ctSubtotalUsd.toFixed(2)}</Typography>
          <Typography variant="caption">Ref. USD CT</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderTop: 4, borderColor: "#ffca28" }}>
          <Typography variant="h5">{formatCop(lotsSummary.realCopTotal)}</Typography>
          <Typography variant="caption">Compra real COP (todos los lotes)</Typography>
        </Paper>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 4 }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Cargando consolidado…</Typography>
        </Box>
      ) : consolidatedLots.length === 0 ? (
        <Alert severity="warning">No hay cartas en tránsito ni lotes abiertos en el panel.</Alert>
      ) : (
        <>
          <TextField
            fullWidth
            size="small"
            label="Buscar carta"
            placeholder="Nombre, idioma, expansión o id…"
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            sx={{ mb: 2, maxWidth: 480 }}
            helperText={
              searchActive
                ? `${filteredLots.length} lote${filteredLots.length !== 1 ? "s" : ""} · ${visibleCardCount} carta${visibleCardCount !== 1 ? "s" : ""} coincidente${visibleCardCount !== 1 ? "s" : ""}`
                : "Filtra cartas en todos los lotes. Los lotes con coincidencias se expanden solos."
            }
          />

          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
            <Typography variant="subtitle1">
              Lotes ({filteredLots.length}
              {searchActive && filteredLots.length !== consolidatedLots.length
                ? ` de ${consolidatedLots.length}`
                : ""}
              )
            </Typography>
            {!searchActive && filteredLots.length > 0 ? (
              <Button
                size="small"
                onClick={() =>
                  setExpandedLotKeys(
                    expandedLotKeys.size === filteredLots.length
                      ? new Set()
                      : new Set(filteredLots.map((l) => l.lotKey)),
                  )
                }
              >
                {expandedLotKeys.size === filteredLots.length ? "Contraer todos" : "Expandir todos"}
              </Button>
            ) : null}
          </Box>

          {filteredLots.length === 0 ? (
            <Alert severity="info">Ninguna carta coincide con «{cardSearch.trim()}».</Alert>
          ) : (
            filteredLots.map((lot) => (
              <ConsolidatedLotCard
                key={lot.lotKey}
                lot={lot}
                expanded={expandedLotKeys.has(lot.lotKey)}
                onToggle={() => toggleLot(lot.lotKey)}
              />
            ))
          )}
        </>
      )}
    </Box>
  );
}
