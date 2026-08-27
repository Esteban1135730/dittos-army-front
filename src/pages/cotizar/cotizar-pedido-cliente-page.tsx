import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import axios from "axios";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { OfferFilterFacet, conditionChipSx } from "../../components/cardtrader-offer-filter-facet";

import {

  buildCartMetaFromOffer,

  loadCardtraderCartMetaCache,

} from "../../utils/cardtrader-cart-meta-cache";

import { upsertCardtraderCartMetaWithImage } from "../../utils/cardtrader-cart-image";
import { enrichCartMetaFromBlueprintBrowse } from "../../utils/cardtrader-cart-enrich";
import {
  cachePedidoBlueprintImage,
  getPedidoBlueprintImageDisplaySrc,
} from "../../utils/cardtrader-pedido-blueprint-image-cache";

import {

  pedidoProgressChanged,

  syncPedidoProgressFromCart,

} from "../../utils/cardtrader-pedido-cart-sync";

import { LanguageChipLabel } from "../../utils/cardtrader-language-flags";

import {

  arraysEqualSorted,

  expansionIdFromProducts,

  firstProductList,

  matchesOfferFilters,

  normalizeBlueprints,

  productConditionLabel,

  productLanguageLabel,

  productUsd,

  uniqueFacetValues,

  productConditionValue,

  productLanguageValue,

  type CtMarketplaceProduct,

} from "../../utils/cardtrader-marketplace-offers";

import {
  availableOfferExtraFacets,
  extraChipSx,
  extraFacetLabel,
  productOfferExtraLabels,
} from "../../utils/cardtrader-offer-extras";

import {

  countPedidoLinesByStatus,

  parseCardtraderPedidoPaste,

  pedidoLineAddedQty,

  pedidoLineRemainingQty,

  pedidoQtyToAddFromOffer,

  isPedidoLinePending,

  type ParsedPedidoLine,

} from "../../utils/parse-cardtrader-pedido";

import {

  detectPedidoPasteKind,

  parseWhatsappQuotePaste,

} from "../../utils/parse-whatsapp-quote";

import {

  applyPedidoQuoteCandidate,

  clearPedidoQuotePick,

  pedidoLineCanLoadOffers,

  pedidoLineShowsCandidates,

  type QuoteResolveApiResult,

} from "../../utils/map-whatsapp-quote-to-pedido";

import {

  buildQuoteSessionCreateBody,

  mapQuoteSessionToPedidoLines,

  type QuoteSessionDetail,

  type QuoteSessionListItem,

} from "../../utils/map-quote-session";

import { QuoteManualSearchDialog } from "./quote-manual-search-dialog";

import {

  clearPedidoProgress,

  loadPedidoProgress,

  savePedidoProgress,

  type PedidoLineStatus,

} from "../../utils/cardtrader-pedido-progress-cache";

import { formatCOP } from "../../utils/convert";

import { computeCardtraderUnitCostCop } from "../../utils/cardtrader-cotizar-pricing";

import { resolveUsdCopRate } from "../../utils/simulate-real-card-price";

import { useExchangeRates } from "../../utils/tasa";

import {

  Alert,

  Box,

  Button,

  Chip,

  CircularProgress,

  Card,

  CardContent,

  CardMedia,

  Divider,

  Link,

  Paper,

  Stack,

  Table,

  TableBody,

  TableCell,

  TableContainer,

  TableHead,

  TableRow,

  TextField,

  Typography,

} from "@mui/material";

import Checkbox from "@mui/material/Checkbox";

import FormControlLabel from "@mui/material/FormControlLabel";



import { API_BASE } from "../../config/api";



function statusChip(
  status: PedidoLineStatus | undefined,
  added: number,
  required: number,
) {
  if (status === "skipped") {
    return <Chip size="small" label="Omitido" color="default" />;
  }
  if (status === "done") {
    return <Chip size="small" label="Hecho" color="success" />;
  }
  if (added >= required && required > 0) {
    return <Chip size="small" label={`En carrito ${required}/${required}`} color="primary" />;
  }
  if (added > 0) {
    return (
      <Chip
        size="small"
        label={`Pendiente ${added}/${required}`}
        color="warning"
        variant="outlined"
      />
    );
  }
  return <Chip size="small" label="Pendiente" color="warning" variant="outlined" />;
}



function FilterGlyph() {

  return (

    <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: 18, height: 18, display: "block" }}>

      <path fill="currentColor" d="M4 5h16v1.6L14 13v5.4l-4 1.2V13L4 6.6V5z" />

    </Box>

  );

}



function parseOptionalUsd(raw: string): number | null {

  const t = raw.trim();

  if (!t) return null;

  const n = Number(t.replace(",", "."));

  return Number.isFinite(n) && n >= 0 ? n : null;

}



export default function CotizarPedidoClientePage() {

  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const { sessionId } = useParams<{ sessionId?: string }>();

  const { rates } = useExchangeRates();

  const copPerUsd = useMemo(() => {

    if (rates.usdToCop === null || rates.usdToCop <= 0) return null;

    return resolveUsdCopRate(rates.usdToCop).copPerUsd;

  }, [rates.usdToCop]);



  const saved = loadPedidoProgress();

  const [rawPaste, setRawPaste] = useState("");

  const [lines, setLines] = useState<ParsedPedidoLine[]>([]);

  const [analyzing, setAnalyzing] = useState(false);

  const [manualSearchOpen, setManualSearchOpen] = useState(false);

  const [statusByLineId, setStatusByLineId] = useState<Record<string, PedidoLineStatus>>(

    () => saved?.statusByLineId ?? {},

  );

  const [addedQtyByLineId, setAddedQtyByLineId] = useState<Record<string, number>>(

    () => saved?.addedQtyByLineId ?? {},

  );

  const [activeLineId, setActiveLineId] = useState<string | null>(saved?.activeLineId ?? null);

  const [viaZero, setViaZero] = useState(true);

  const [parseError, setParseError] = useState<string | null>(null);



  const [draftOfferConditions, setDraftOfferConditions] = useState<string[]>([]);

  const [draftOfferLanguages, setDraftOfferLanguages] = useState<string[]>([]);

  const [appliedOfferConditions, setAppliedOfferConditions] = useState<string[]>([]);

  const [appliedOfferLanguages, setAppliedOfferLanguages] = useState<string[]>([]);

  const [draftOfferExtras, setDraftOfferExtras] = useState<string[]>([]);

  const [appliedOfferExtras, setAppliedOfferExtras] = useState<string[]>([]);

  const [draftMinUsd, setDraftMinUsd] = useState("");

  const [draftMaxUsd, setDraftMaxUsd] = useState("");

  const [appliedMinUsd, setAppliedMinUsd] = useState<number | null>(null);

  const [appliedMaxUsd, setAppliedMaxUsd] = useState<number | null>(null);

  const [pedidoBlueprintImageSrc, setPedidoBlueprintImageSrc] = useState<string | undefined>();



  const activeLine = useMemo(

    () => lines.find((l) => l.id === activeLineId) ?? null,

    [lines, activeLineId],

  );



  const sessionQuery = useQuery({

    queryKey: ["cardtrader", "quote-session", sessionId],

    enabled: !!sessionId,

    queryFn: async () => {

      const res = await axios.get(`${API_BASE}/cardtrader/quote-sessions/${sessionId}`);

      return res.data as QuoteSessionDetail;

    },

  });

  const sessionListQuery = useQuery({

    queryKey: ["cardtrader", "quote-sessions"],

    enabled: !sessionId,

    queryFn: async () => {

      const res = await axios.get(`${API_BASE}/cardtrader/quote-sessions`, {

        params: { status: "in_progress" },

      });

      const items = Array.isArray((res.data as { items?: QuoteSessionListItem[] })?.items)

        ? (res.data as { items: QuoteSessionListItem[] }).items

        : [];

      return items;

    },

  });

  useEffect(() => {

    if (!sessionQuery.data) return;

    const mapped = mapQuoteSessionToPedidoLines(sessionQuery.data);

    setLines(mapped);

    const idx = Math.min(

      Math.max(0, sessionQuery.data.active_index ?? 0),

      Math.max(0, mapped.length - 1),

    );

    setActiveLineId(mapped[idx]?.id ?? null);

    const nextStatus: Record<string, PedidoLineStatus> = {};

    for (const line of mapped) {

      const raw = sessionQuery.data.lines[line.lineNumber - 1]?.line_status;

      nextStatus[line.id] = raw === "skipped" ? "skipped" : "pending";

    }

    setStatusByLineId(nextStatus);

  }, [sessionQuery.data]);



  const resetOfferFilters = useCallback(() => {

    setDraftOfferConditions([]);

    setDraftOfferLanguages([]);

    setAppliedOfferConditions([]);

    setAppliedOfferLanguages([]);

    setDraftOfferExtras([]);

    setAppliedOfferExtras([]);

    setDraftMinUsd("");

    setDraftMaxUsd("");

    setAppliedMinUsd(null);

    setAppliedMaxUsd(null);

  }, []);



  const counts = useMemo(

    () => countPedidoLinesByStatus(lines, statusByLineId, addedQtyByLineId),

    [lines, statusByLineId, addedQtyByLineId],

  );



  const persistProgress = useCallback(

    (

      nextStatus: Record<string, PedidoLineStatus>,

      nextActive: string | null,

      nextAdded?: Record<string, number>,

      nextLines?: ParsedPedidoLine[],

    ) => {

      if (sessionId) return;

      const snapshotLines = nextLines ?? lines;

      if (!rawPaste.trim() || snapshotLines.length === 0) return;

      savePedidoProgress({

        rawPaste,

        statusByLineId: nextStatus,

        addedQtyByLineId: nextAdded ?? addedQtyByLineId,

        activeLineId: nextActive,

        lines: snapshotLines,

      });

    },

    [rawPaste, lines, addedQtyByLineId, sessionId],

  );



  const setLineStatus = useCallback(

    (lineId: string, status: PedidoLineStatus) => {

      setStatusByLineId((prev) => {

        const next = { ...prev, [lineId]: status };

        persistProgress(next, activeLineId);

        return next;

      });

    },

    [activeLineId, persistProgress],

  );



  const chooseCandidate = (lineId: string, candidate: Parameters<typeof applyPedidoQuoteCandidate>[1]) => {

    setLines((prev) =>

      prev.map((l) => (l.id === lineId ? applyPedidoQuoteCandidate(l, candidate) : l)),

    );

    if (sessionId) {

      const idx = lines.findIndex((l) => l.id === lineId);

      if (idx >= 0) {

        void axios.patch(`${API_BASE}/cardtrader/quote-sessions/${sessionId}/lines/${idx}`, {

          action: "pick",

          blueprint_id: candidate.blueprintId,

          expansion_id: candidate.expansionId,

          expansion_name: candidate.expansionName,

          name: candidate.name,

          collector_number: candidate.collectorNumber,

          image_url: candidate.imageUrl,

        });

      }

    }

  };



  const handleParse = async () => {

    const kind = detectPedidoPasteKind(rawPaste);

    const pasteSnapshot = rawPaste;

    const goSession = async (

      source: "whatsapp" | "urls",

      extra: Omit<Parameters<typeof buildQuoteSessionCreateBody>[0], "source" | "rawPaste">,

    ) => {

      const body = buildQuoteSessionCreateBody({ ...extra, source, rawPaste: pasteSnapshot });

      const created = await axios.post(`${API_BASE}/cardtrader/quote-sessions`, body);

      const id = String((created.data as { id?: string })?.id ?? "");

      if (!id) throw new Error("sesión sin id");

      setRawPaste("");

      clearPedidoProgress();

      await queryClient.invalidateQueries({ queryKey: ["cardtrader", "quote-sessions"] });

      navigate(`/cotizar/pedido-cliente/${id}`);

    };

    if (kind === "urls") {

      const parsed = parseCardtraderPedidoPaste(rawPaste);

      if (parsed.length === 0) {

        setParseError("No se encontraron URLs de CardTrader. Revisa el texto pegado.");

        setLines([]);

        return;

      }

      setAnalyzing(true);

      setParseError(null);

      try {

        await goSession("urls", { urlLines: parsed });

      } catch {

        setParseError("No se pudo guardar la sesión. El texto se conserva para reintentar.");

      } finally {

        setAnalyzing(false);

      }

      return;

    }

    if (kind !== "quote") {

      setParseError(

        "No se encontraron URLs de CardTrader ni líneas de cotización. Revisa el texto pegado.",

      );

      setLines([]);

      return;

    }

    const quoteLines = parseWhatsappQuotePaste(rawPaste);

    setAnalyzing(true);

    setParseError(null);

    try {

      const res = await axios.post(`${API_BASE}/cardtrader/quote-lines/resolve`, {

        lines: quoteLines.map((q) => ({

          name: q.name,

          expansion: q.expansion,

          collector_number: q.collectorNumber,

          language_label: q.languageLabel,

          condition_label: q.conditionLabel,

        })),

      });

      const results = Array.isArray(res.data?.results)

        ? (res.data.results as QuoteResolveApiResult[])

        : [];

      await goSession("whatsapp", { quoteLines, results });

    } catch (err) {

      if (axios.isAxiosError(err)) {

        const status = err.response?.status;

        if (status === 429) {

          setParseError(

            "CardTrader: demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.",

          );

          return;

        }

        if (status === 503) {

          setParseError("CardTrader no está configurado o no está disponible.");

          return;

        }

      }

      setParseError("No se pudieron resolver las cartas. Revisa la conexión e inténtalo de nuevo.");

    } finally {

      setAnalyzing(false);

    }

  };



  const goToNextPending = useCallback(() => {

    if (!lines.length) return;

    const idx = lines.findIndex((l) => l.id === activeLineId);

    const order = [...lines.slice(idx + 1), ...lines.slice(0, idx)];

    const next = order.find((l) => isPedidoLinePending(l, statusByLineId, addedQtyByLineId));

    if (next) setActiveLineId(next.id);

  }, [lines, activeLineId, statusByLineId, addedQtyByLineId]);



  const activeIndex = Math.max(0, lines.findIndex((l) => l.id === activeLineId));

  const goSessionIndex = (idx: number) => {

    if (idx < 0 || idx >= lines.length) return;

    setActiveLineId(lines[idx].id);

    if (sessionId) {

      void axios.patch(`${API_BASE}/cardtrader/quote-sessions/${sessionId}`, {

        active_index: idx,

      });

    }

  };

  const undoPick = () => {

    if (!activeLine) return;

    setLines((prev) => prev.map((l) => (l.id === activeLine.id ? clearPedidoQuotePick(l) : l)));

    if (sessionId) {

      void axios.patch(

        `${API_BASE}/cardtrader/quote-sessions/${sessionId}/lines/${activeIndex}`,

        { action: "undo_pick" },

      );

    }

  };

  const skipCurrent = () => {

    if (!activeLine) return;

    setLineStatus(activeLine.id, "skipped");

    if (sessionId) {

      void axios.patch(

        `${API_BASE}/cardtrader/quote-sessions/${sessionId}/lines/${activeIndex}`,

        { action: "skip" },

      );

    }

    if (activeIndex + 1 < lines.length) goSessionIndex(activeIndex + 1);

  };



  useEffect(() => {

    persistProgress(statusByLineId, activeLineId, addedQtyByLineId);

  }, [activeLineId, statusByLineId, addedQtyByLineId, persistProgress]);



  useEffect(() => {

    resetOfferFilters();

    const lang = activeLine?.pokemonLanguage?.trim().toLowerCase();

    if (lang) {

      setDraftOfferLanguages([lang]);

      setAppliedOfferLanguages([lang]);

    }

    const condition = activeLine?.conditionFilter?.trim();

    if (condition) {

      setDraftOfferConditions([condition]);

      setAppliedOfferConditions([condition]);

    }

  }, [activeLine?.id, activeLine?.pokemonLanguage, activeLine?.conditionFilter, resetOfferFilters]);



  const productsQuery = useQuery({

    queryKey: ["cardtrader", "pedido-line", activeLine?.blueprintId],

    enabled: !!activeLine && pedidoLineCanLoadOffers(activeLine),

    staleTime: 90_000,

    queryFn: async () => {

      const res = await axios.get(`${API_BASE}/cardtrader/marketplace/products`, {

        params: { blueprint_id: activeLine!.blueprintId },

      });

      return res.data as unknown;

    },

  });



  const cartQuery = useQuery({

    queryKey: ["cardtrader", "cart"],

    enabled: lines.length > 0,

    staleTime: 15_000,

    queryFn: async () => {

      const res = await axios.get(`${API_BASE}/cardtrader/cart`);

      return res.data as unknown;

    },

  });



  const applyCartSync = useCallback(

    (cartData: unknown) => {

      if (!lines.length) return null;

      const meta = loadCardtraderCartMetaCache();

      return syncPedidoProgressFromCart(lines, cartData, meta, statusByLineId);

    },

    [lines, statusByLineId],

  );



  useEffect(() => {

    if (!cartQuery.isSuccess || !lines.length) return;

    const synced = applyCartSync(cartQuery.data);

    if (!synced) return;

    if (

      !pedidoProgressChanged(

        lines,

        addedQtyByLineId,

        synced.addedQtyByLineId,

        statusByLineId,

        synced.statusByLineId,

      )

    ) {

      return;

    }

    setAddedQtyByLineId(synced.addedQtyByLineId);

    setStatusByLineId(synced.statusByLineId);

    persistProgress(synced.statusByLineId, activeLineId, synced.addedQtyByLineId);

  }, [

    cartQuery.isSuccess,

    cartQuery.data,

    lines,

    applyCartSync,

    addedQtyByLineId,

    statusByLineId,

    activeLineId,

    persistProgress,

  ]);



  const rawProducts = useMemo(() => {

    return firstProductList(productsQuery.data).filter((p) => (p.quantity ?? 0) > 0);

  }, [productsQuery.data]);



  const clientMaxUsd = activeLine?.maxUsdHint ?? null;



  const baseOffers = useMemo(() => {

    let list = rawProducts;

    if (clientMaxUsd != null) {

      list = list.filter((p) => productUsd(p) <= clientMaxUsd + 0.001);

    }

    return list;

  }, [rawProducts, clientMaxUsd]);



  const effectiveMaxUsd = appliedMaxUsd ?? clientMaxUsd;



  const offers = useMemo(() => {

    const list = baseOffers.filter((p) =>

      matchesOfferFilters(

        p,

        appliedOfferConditions,

        appliedOfferLanguages,

        effectiveMaxUsd,

        appliedMinUsd,

        appliedOfferExtras,

      ),

    );

    return list.sort((a, b) => (a.price?.cents ?? 0) - (b.price?.cents ?? 0));

  }, [

    baseOffers,

    appliedOfferConditions,

    appliedOfferLanguages,

    effectiveMaxUsd,

    appliedMinUsd,

    appliedOfferExtras,

  ]);



  const availableConditions = useMemo(

    () => uniqueFacetValues(baseOffers, productConditionValue),

    [baseOffers],

  );



  const availableLanguages = useMemo(

    () => uniqueFacetValues(baseOffers, productLanguageValue),

    [baseOffers],

  );



  const availableExtras = useMemo(() => availableOfferExtraFacets(baseOffers), [baseOffers]);



  const expansionId = useMemo(() => {

    if (typeof activeLine?.expansionId === "number" && activeLine.expansionId > 0) {

      return activeLine.expansionId;

    }

    return expansionIdFromProducts(rawProducts);

  }, [activeLine?.expansionId, rawProducts]);



  const blueprintsQuery = useQuery({

    queryKey: ["cardtrader", "blueprints", expansionId],

    enabled: !!expansionId && !!activeLine?.blueprintId,

    staleTime: 3_600_000,

    queryFn: async () => {

      const res = await axios.get(`${API_BASE}/cardtrader/blueprints`, {

        params: { expansion_id: expansionId },

      });

      return res.data as unknown;

    },

  });



  const blueprintImageUrl = useMemo(() => {

    if (!activeLine?.blueprintId) return null;

    const bps = normalizeBlueprints(blueprintsQuery.data);

    const bp = bps.find((b) => b.id === activeLine.blueprintId);

    const url = bp?.image_url?.trim();

    return url || activeLine.imageUrl || null;

  }, [blueprintsQuery.data, activeLine?.blueprintId, activeLine?.imageUrl]);



  const blueprintMeta = useMemo(() => {

    if (!activeLine?.blueprintId) return null;

    const bps = normalizeBlueprints(blueprintsQuery.data);

    return bps.find((b) => b.id === activeLine.blueprintId) ?? null;

  }, [blueprintsQuery.data, activeLine?.blueprintId]);



  useEffect(() => {

    const blueprintId = activeLine?.blueprintId;

    if (!blueprintId) {

      setPedidoBlueprintImageSrc(undefined);

      return;

    }

    const immediate = getPedidoBlueprintImageDisplaySrc(

      blueprintId,

      blueprintImageUrl,

      API_BASE,

    );

    setPedidoBlueprintImageSrc(immediate);

    if (!blueprintImageUrl?.trim()) return;

    let cancelled = false;

    void cachePedidoBlueprintImage(blueprintId, blueprintImageUrl, API_BASE).then((dataUrl) => {

      if (!cancelled && dataUrl) setPedidoBlueprintImageSrc(dataUrl);

    });

    return () => {

      cancelled = true;

    };

  }, [activeLine?.blueprintId, blueprintImageUrl]);



  useEffect(() => {

    if (!blueprintMeta || !cartQuery.data) return;

    let cancelled = false;

    void (async () => {

      await enrichCartMetaFromBlueprintBrowse({

        cart: cartQuery.data,

        blueprint: blueprintMeta,

        expansion: rawProducts[0]?.expansion ?? null,

        marketplaceProducts: rawProducts,

        blueprintImageUrl: blueprintImageUrl ?? undefined,

        apiBase: API_BASE,

      });

      if (cancelled) return;

    })();

    return () => {

      cancelled = true;

    };

  }, [

    blueprintMeta,

    cartQuery.data,

    rawProducts,

    blueprintImageUrl,

  ]);



  const offerFiltersPending =

    !arraysEqualSorted(draftOfferConditions, appliedOfferConditions) ||

    !arraysEqualSorted(draftOfferLanguages, appliedOfferLanguages) ||

    !arraysEqualSorted(draftOfferExtras, appliedOfferExtras) ||

    parseOptionalUsd(draftMinUsd) !== appliedMinUsd ||

    parseOptionalUsd(draftMaxUsd) !== appliedMaxUsd;



  const applyOfferFilters = () => {

    setAppliedOfferConditions([...draftOfferConditions]);

    setAppliedOfferLanguages([...draftOfferLanguages]);

    setAppliedOfferExtras([...draftOfferExtras]);

    setAppliedMinUsd(parseOptionalUsd(draftMinUsd));

    setAppliedMaxUsd(parseOptionalUsd(draftMaxUsd));

  };



  const clearOfferFilters = () => {

    resetOfferFilters();

  };



  const toggleDraftCondition = (value: string) => {

    setDraftOfferConditions((prev) =>

      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],

    );

  };



  const toggleDraftLanguage = (value: string) => {

    setDraftOfferLanguages((prev) =>

      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],

    );

  };



  const removeAppliedCondition = (value: string) => {

    setAppliedOfferConditions((prev) => prev.filter((v) => v !== value));

    setDraftOfferConditions((prev) => prev.filter((v) => v !== value));

  };



  const removeAppliedLanguage = (value: string) => {

    setAppliedOfferLanguages((prev) => prev.filter((v) => v !== value));

    setDraftOfferLanguages((prev) => prev.filter((v) => v !== value));

  };



  const toggleDraftExtra = (value: string) => {

    setDraftOfferExtras((prev) =>

      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],

    );

  };



  const removeAppliedExtra = (value: string) => {

    setAppliedOfferExtras((prev) => prev.filter((v) => v !== value));

    setDraftOfferExtras((prev) => prev.filter((v) => v !== value));

  };



  const addMutation = useMutation({

    mutationFn: async (payload: {

      product_id: number;

      quantity: number;

      meta: ReturnType<typeof buildCartMetaFromOffer>;

    }) => {

      await axios.post(`${API_BASE}/cardtrader/cart/items`, {

        product_id: payload.product_id,

        quantity: payload.quantity,

        via_cardtrader_zero: viaZero,

      });

      return payload;

    },

    onSuccess: async (payload) => {

      await upsertCardtraderCartMetaWithImage(payload.product_id, payload.meta, API_BASE);

      void queryClient.invalidateQueries({ queryKey: ["cardtrader", "cart"] });

    },

  });



  const buildMetaForProduct = useCallback(

    (p: CtMarketplaceProduct) =>

      buildCartMetaFromOffer({

        product: p,

        blueprint: blueprintMeta,

        expansion: p.expansion ?? null,

        blueprintImageUrl: blueprintImageUrl ?? undefined,

      }),

    [blueprintMeta, blueprintImageUrl],

  );



  const addOfferToLine = useCallback(

    async (line: ParsedPedidoLine, p: CtMarketplaceProduct) => {

      const toAdd = pedidoQtyToAddFromOffer(line, addedQtyByLineId, p.quantity);

      if (toAdd <= 0) return;

      const wasPedidoComplete = pedidoLineRemainingQty(line, addedQtyByLineId) <= 0;

      const meta = buildMetaForProduct(p);

      await addMutation.mutateAsync({

        product_id: p.id,

        quantity: toAdd,

        meta,

      });

      await queryClient.refetchQueries({ queryKey: ["cardtrader", "cart"] });

      const cart = queryClient.getQueryData<unknown>(["cardtrader", "cart"]);

      const synced = applyCartSync(cart);

      if (synced) {

        setAddedQtyByLineId(synced.addedQtyByLineId);

        setStatusByLineId(synced.statusByLineId);

        persistProgress(synced.statusByLineId, activeLineId, synced.addedQtyByLineId);

        if (
          !wasPedidoComplete &&
          (synced.addedQtyByLineId[line.id] ?? 0) >= line.quantity
        ) {
          goToNextPending();
        }

      }

    },

    [

      addMutation,

      activeLineId,

      applyCartSync,

      buildMetaForProduct,

      goToNextPending,

      persistProgress,

      queryClient,

    ],

  );



  const addCheapest = async () => {

    if (!activeLine || offers.length === 0) return;

    await addOfferToLine(activeLine, offers[0]);

  };



  return (

    <Box className="p-4" sx={{ maxWidth: 1400, mx: "auto" }}>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>

        <Box>

          <Typography variant="h5" fontWeight={700}>

            {sessionId ? `Carta ${activeIndex + 1} de ${lines.length || "…"}` : "Pegar cotización (WhatsApp / URLs)"}

          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>

            {sessionId

              ? "Una carta a la vez. Elige el match, busca a mano si hace falta y añade ofertas."

              : "Pega el mensaje de cotización de la tienda o URLs de CardTrader. Tras analizar se guarda y se vacía este cuadro."}

          </Typography>

        </Box>

        <Stack direction="row" spacing={1}>

        <Button component={RouterLink} to="/cotizar" variant="outlined" size="small">

          Ir a Cotizar

        </Button>

        {sessionId && (

          <Button component={RouterLink} to="/cotizar/pedido-cliente" variant="outlined" size="small">

            Nueva cotización

          </Button>

        )}

        </Stack>

      </Stack>



      {!sessionId && (

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>

        <TextField

          multiline

          minRows={8}

          maxRows={16}

          fullWidth

          label="Lista del cliente (URLs o cotización WhatsApp)"

          placeholder={"X2 https://www.cardtrader.com/es/cards/...\n\nHola, deseo cotizar las siguientes cartas contigo:\n- Pikachu (Base Set #25) — Idioma: Inglés, Estado: Perfecto"}

          value={rawPaste}

          onChange={(e) => setRawPaste(e.target.value)}

        />

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>

          <Button variant="contained" onClick={() => void handleParse()} disabled={analyzing}>

            {analyzing ? "Resolviendo cartas…" : "Analizar pedido"}

          </Button>

          <Button

            variant="outlined"

            color="inherit"

            onClick={() => {

              clearPedidoProgress();

              setRawPaste("");

              setLines([]);

              setStatusByLineId({});

              setAddedQtyByLineId({});

              setActiveLineId(null);

              setParseError(null);

              resetOfferFilters();

            }}

          >

            Limpiar todo

          </Button>

          <FormControlLabel

            control={<Checkbox checked={viaZero} onChange={(_, c) => setViaZero(c)} size="small" />}

            label="CardTrader Zero"

          />

        </Stack>

        {parseError && (

          <Alert severity="error" sx={{ mt: 1.5 }}>

            {parseError}

          </Alert>

        )}

        {lines.length > 0 && (

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>

            {counts.total} líneas · {counts.pending} pendientes · {counts.done} hechas · {counts.skipped}{" "}

            omitidas · progreso guardado 48 h

          </Typography>

        )}

      </Paper>

      )}

      {!sessionId && (sessionListQuery.data?.length ?? 0) > 0 && (

        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>

            Cotizaciones en curso

          </Typography>

          <Stack spacing={1}>

            {(sessionListQuery.data ?? []).map((s) => (

              <Button

                key={s.id}

                variant="outlined"

                sx={{ justifyContent: "flex-start", textTransform: "none" }}

                onClick={() => navigate(`/cotizar/pedido-cliente/${s.id}`)}

              >

                {s.line_count} cartas · paso {(s.active_index ?? 0) + 1} · {s.source}

              </Button>

            ))}

          </Stack>

        </Paper>

      )}

      {sessionId && sessionQuery.isError && (

        <Alert severity="error" sx={{ mb: 2 }}>

          No se encontró esta cotización. Vuelve a pegar el mensaje.

        </Alert>

      )}

      {sessionId && lines.length > 0 && (

        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">

            <Button variant="outlined" disabled={activeIndex <= 0} onClick={() => goSessionIndex(activeIndex - 1)}>

              Anterior

            </Button>

            <Button

              variant="outlined"

              disabled={activeIndex >= lines.length - 1}

              onClick={() => goSessionIndex(activeIndex + 1)}

            >

              Siguiente

            </Button>

            <Button variant="outlined" onClick={skipCurrent}>

              Omitir

            </Button>

            {activeLine?.selectedCandidate && (

              <Button variant="outlined" color="warning" onClick={undoPick}>

                Deshacer carta elegida

              </Button>

            )}

            <Button variant="contained" onClick={() => setManualSearchOpen(true)}>

              Búsqueda manual

            </Button>

            <Button

              variant="outlined"

              onClick={() => {

                if (!sessionId) return;

                if (!window.confirm("¿Cerrar esta cotización?")) return;

                void axios

                  .patch(`${API_BASE}/cardtrader/quote-sessions/${sessionId}`, { status: "completed" })

                  .then(() => navigate("/cotizar/pedido-cliente"));

              }}

            >

              Completar

            </Button>

          </Stack>

        </Paper>

      )}



      {lines.length > 0 && (

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="flex-start">

          {!sessionId && (

          <Paper

            sx={{

              width: { xs: "100%", lg: 380 },

              flexShrink: 0,

              maxHeight: { lg: "calc(100vh - 200px)" },

              overflow: "auto",

              borderRadius: 2,

            }}

          >

            <Box

              sx={{

                p: 1.5,

                borderBottom: 1,

                borderColor: "divider",

                position: "sticky",

                top: 0,

                bgcolor: "background.paper",

                zIndex: 1,

              }}

            >

              <Typography variant="subtitle2" fontWeight={700}>

                Orden del pedido

              </Typography>

              <Button size="small" sx={{ mt: 0.5 }} onClick={goToNextPending}>

                Siguiente pendiente

              </Button>

            </Box>

            {lines.map((line) => {

              const selected = line.id === activeLineId;

              const status = statusByLineId[line.id] ?? "pending";

              return (

                <Box

                  key={line.id}

                  onClick={() => setActiveLineId(line.id)}

                  sx={{

                    px: 1.5,

                    py: 1,

                    cursor: "pointer",

                    borderBottom: 1,

                    borderColor: "divider",

                    bgcolor: selected ? "action.selected" : undefined,

                    "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },

                  }}

                >

                  <Stack direction="row" spacing={1} alignItems="flex-start">

                    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 24 }}>

                      {line.lineNumber}.

                    </Typography>

                    <Box sx={{ flex: 1, minWidth: 0 }}>

                      <Typography variant="body2" fontWeight={600} noWrap title={line.displayName}>

                        {line.quantity > 1 ? `×${line.quantity} ` : ""}

                        {line.displayName}

                      </Typography>

                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }} flexWrap="wrap" useFlexGap>

                        {statusChip(

                          status,

                          pedidoLineAddedQty(addedQtyByLineId, line.id),

                          line.quantity,

                        )}

                        {line.maxUsdHint != null && (

                          <Chip size="small" label={`≤ $${line.maxUsdHint}`} variant="outlined" />

                        )}

                        {line.resolveStatus === "not_found" && (

                          <Chip size="small" label="Sin match" color="error" variant="outlined" />

                        )}

                        {line.resolveStatus === "ambiguous" && (

                          <Chip size="small" label="Varios" color="warning" variant="outlined" />

                        )}

                      </Stack>

                    </Box>

                  </Stack>

                </Box>

              );

            })}

          </Paper>

          )}



          <Paper sx={{ flex: 1, p: 2, borderRadius: 2, minWidth: 0 }}>

            {!activeLine ? (

              <Typography color="text.secondary">Selecciona una línea de la lista.</Typography>

            ) : (

              <Stack spacing={2}>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ flexShrink: 0 }}
                  >
                    <Box
                      sx={{
                        width: { xs: "100%", sm: 140 },
                        flexShrink: 0,
                        borderRadius: 2,
                        overflow: "hidden",
                        bgcolor: "grey.100",
                        border: 1,
                        borderColor: "divider",
                        minHeight: 196,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {blueprintsQuery.isLoading && expansionId ? (
                        <CircularProgress size={28} />
                      ) : pedidoBlueprintImageSrc ? (
                        <Box
                          component="img"
                          src={pedidoBlueprintImageSrc}
                          alt=""
                          sx={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block" }}
                          onError={(ev) => {
                            (ev.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : blueprintImageUrl && !blueprintsQuery.isLoading ? (
                        <CircularProgress size={28} />
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ p: 1, textAlign: "center" }}>
                          Sin imagen
                        </Typography>
                      )}
                    </Box>

                    {activeLine.clientNotes.trim() ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          width: { xs: "100%", sm: 200, md: 220 },
                          maxWidth: "100%",
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: "info.50",
                          borderColor: "info.light",
                          borderLeftWidth: 4,
                          borderLeftStyle: "solid",
                          borderLeftColor: "info.main",
                        }}
                      >
                        <Typography
                          variant="overline"
                          sx={{ lineHeight: 1.2, fontWeight: 700, color: "info.dark", display: "block" }}
                        >
                          Nota del cliente
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 }}
                        >
                          {activeLine.clientNotes}
                        </Typography>
                      </Paper>
                    ) : null}
                  </Stack>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700}>
                          #{activeLine.lineNumber} · {activeLine.displayName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {activeLine.blueprintId > 0
                            ? `Blueprint ${activeLine.blueprintId} · pedido ×${activeLine.quantity}`
                            : `pedido ×${activeLine.quantity}`}
                          {activeLine.expansionName ? ` · ${activeLine.expansionName}` : ""}
                          {activeLine.collectorNumber
                            ? ` · #${activeLine.collectorNumber}`
                            : blueprintMeta?.fixed_properties?.collector_number
                            ? ` · #${blueprintMeta.fixed_properties.collector_number}`
                            : ""}
                        </Typography>
                        {pedidoLineRemainingQty(activeLine, addedQtyByLineId) > 0 ? (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            En carrito: {pedidoLineAddedQty(addedQtyByLineId, activeLine.id)} /{" "}
                            {activeLine.quantity} · faltan{" "}
                            {pedidoLineRemainingQty(activeLine, addedQtyByLineId)}
                          </Typography>
                        ) : (
                          <Chip
                            size="small"
                            color="success"
                            label="Cantidad completa en carrito"
                            sx={{ mt: 0.75 }}
                          />
                        )}
                        {clientMaxUsd != null && (
                          <Chip
                            size="small"
                            label={`Tope cliente: ≤ $${clientMaxUsd}`}
                            sx={{ mt: 0.75 }}
                            variant="outlined"
                          />
                        )}
                      </Box>
                      {activeLine.url ? (
                      <Link href={activeLine.url} target="_blank" rel="noreferrer" variant="body2">
                        Abrir en CardTrader
                      </Link>
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>

                {activeLine.resolveStatus === "not_found" && (
                  <Alert severity="warning">
                    No se encontró esta carta en CardTrader. Usa búsqueda manual u omítela.
                  </Alert>
                )}

                {pedidoLineShowsCandidates(activeLine) && (
                  <Alert severity="info">
                    Hay varias coincidencias. Elige la carta por la imagen.
                  </Alert>
                )}

                {pedidoLineShowsCandidates(activeLine) && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                      gap: 1,
                    }}
                  >
                    {activeLine.candidates!.map((c) => (
                      <Card
                        key={c.blueprintId}
                        variant="outlined"
                        sx={{ cursor: "pointer" }}
                        onClick={() => chooseCandidate(activeLine.id, c)}
                      >
                        {c.imageUrl ? (
                          <CardMedia
                            component="img"
                            height="140"
                            image={c.imageUrl}
                            alt=""
                            sx={{ objectFit: "contain", bgcolor: "grey.100" }}
                          />
                        ) : (
                          <Box sx={{ height: 140, bgcolor: "grey.200" }} />
                        )}
                        <CardContent sx={{ py: 1, px: 1 }}>
                          <Typography variant="body2" noWrap>
                            {c.name || activeLine.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" noWrap>
                            {c.expansionName}
                            {c.collectorNumber ? ` · #${c.collectorNumber}` : ""}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>

                  <Button

                    variant="contained"

                    onClick={() => void addCheapest()}

                    disabled={

                      addMutation.isPending ||

                      !pedidoLineCanLoadOffers(activeLine) ||

                      offers.length === 0 ||

                      pedidoQtyToAddFromOffer(activeLine, addedQtyByLineId, offers[0]?.quantity) <=

                        0

                    }

                  >

                    {(() => {

                      const toAdd = pedidoQtyToAddFromOffer(

                        activeLine,

                        addedQtyByLineId,

                        offers[0]?.quantity,

                      );

                      const remaining = pedidoLineRemainingQty(activeLine, addedQtyByLineId);

                      if (toAdd <= 0) return "Sin stock en oferta más barata";

                      if (remaining <= 0) return `Añadir ${toAdd} (extra)`;

                      return `Añadir ${toAdd} (faltan ${remaining})`;

                    })()}

                  </Button>

                  <Button

                    variant="outlined"

                    onClick={() => {

                      setLineStatus(activeLine.id, "done");

                      goToNextPending();

                    }}

                  >

                    Marcar hecho

                  </Button>

                  <Button

                    variant="text"

                    color="inherit"

                    onClick={() => {

                      setLineStatus(activeLine.id, "skipped");

                      goToNextPending();

                    }}

                  >

                    Omitir

                  </Button>

                </Stack>



                {!pedidoLineCanLoadOffers(activeLine) ? null : productsQuery.isLoading ? (

                  <CircularProgress size={28} />

                ) : productsQuery.isError ? (

                  <Alert severity="error">No se pudieron cargar ofertas (¿token CardTrader en el back?).</Alert>

                ) : baseOffers.length === 0 ? (

                  <Alert severity="warning">

                    Sin ofertas{clientMaxUsd != null ? ` bajo $${clientMaxUsd}` : ""}. Revisa en CardTrader o

                    ajusta criterios del cliente.

                  </Alert>

                ) : (

                  <>

                    <Paper

                      variant="outlined"

                      sx={{

                        borderRadius: 2,

                        overflow: "hidden",

                        bgcolor: "grey.50",

                        borderColor: offerFiltersPending ? "primary.light" : "divider",

                      }}

                    >

                      <Box

                        sx={{

                          px: 2,

                          py: 1.25,

                          bgcolor: "background.paper",

                          borderBottom: 1,

                          borderColor: "divider",

                        }}

                      >

                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>

                          <Stack direction="row" alignItems="center" spacing={1}>

                            <Box

                              sx={{

                                display: "flex",

                                alignItems: "center",

                                justifyContent: "center",

                                width: 32,

                                height: 32,

                                borderRadius: 1.5,

                                bgcolor: "primary.main",

                                color: "primary.contrastText",

                              }}

                            >

                              <FilterGlyph />

                            </Box>

                            <Box>

                              <Typography variant="subtitle2" fontWeight={700}>

                                Filtros de ofertas

                              </Typography>

                              <Typography variant="caption" color="text.secondary">

                                {baseOffers.length} ofertas cargadas · mostrando {offers.length}

                              </Typography>

                            </Box>

                          </Stack>

                          {offerFiltersPending && (

                            <Chip size="small" label="Sin aplicar" color="warning" variant="outlined" />

                          )}

                        </Stack>

                      </Box>



                      <Box sx={{ px: 2, py: 1.5 }}>

                        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

                          <Box sx={{ flex: 1, minWidth: 0 }}>

                            <Typography variant="overline" sx={{ fontWeight: 700, color: "text.secondary" }}>

                              Estado

                            </Typography>

                            <Box sx={{ mt: 0.75 }}>

                              <OfferFilterFacet

                                hint="Sin estados en el listado."

                                options={availableConditions}

                                selected={draftOfferConditions}

                                onToggle={toggleDraftCondition}

                                chipSxForValue={(v) => conditionChipSx(v)}

                              />

                            </Box>

                          </Box>

                          <Divider sx={{ display: { xs: "block", md: "none" } }} />

                          <Box sx={{ flex: 1, minWidth: 0 }}>

                            <Typography variant="overline" sx={{ fontWeight: 700, color: "text.secondary" }}>

                              Idioma

                            </Typography>

                            <Box sx={{ mt: 0.75 }}>

                              <OfferFilterFacet

                                hint="Sin idiomas en el listado."

                                options={availableLanguages}

                                selected={draftOfferLanguages}

                                onToggle={toggleDraftLanguage}

                                withFlagIcon

                              />

                            </Box>

                          </Box>

                        </Stack>

                        {availableExtras.length > 0 && (

                          <Box sx={{ mt: 1.5 }}>

                            <Typography variant="overline" sx={{ fontWeight: 700, color: "text.secondary" }}>

                              Extras

                            </Typography>

                            <Box sx={{ mt: 0.75 }}>

                              <OfferFilterFacet

                                hint="Sin extras en el listado."

                                options={availableExtras.map((e) => e.id)}

                                selected={draftOfferExtras}

                                onToggle={toggleDraftExtra}

                                renderLabel={(id) => extraFacetLabel(id)}

                                chipSxForValue={(id) => extraChipSx(extraFacetLabel(id))}

                              />

                            </Box>

                          </Box>

                        )}

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1.5 }}>

                          <TextField

                            size="small"

                            label="Precio mín. USD"

                            type="number"

                            inputProps={{ min: 0, step: 0.01 }}

                            value={draftMinUsd}

                            onChange={(e) => setDraftMinUsd(e.target.value)}

                            sx={{ maxWidth: 160 }}

                          />

                          <TextField

                            size="small"

                            label="Precio máx. USD"

                            type="number"

                            inputProps={{ min: 0, step: 0.01 }}

                            value={draftMaxUsd}

                            onChange={(e) => setDraftMaxUsd(e.target.value)}

                            helperText={

                              clientMaxUsd != null && !draftMaxUsd.trim()

                                ? `Por defecto tope cliente $${clientMaxUsd}`

                                : undefined

                            }

                            sx={{ maxWidth: 160 }}

                          />

                        </Stack>

                      </Box>



                      {(appliedOfferConditions.length > 0 ||

                        appliedOfferLanguages.length > 0 ||

                        appliedOfferExtras.length > 0 ||

                        appliedMinUsd != null ||

                        (appliedMaxUsd != null && appliedMaxUsd !== clientMaxUsd)) && (

                        <Box sx={{ px: 2, py: 1, bgcolor: "action.hover", borderTop: 1, borderColor: "divider" }}>

                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>

                            Filtros activos

                          </Typography>

                          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>

                            {appliedOfferConditions.map((c) => (

                              <Chip

                                key={`cond-${c}`}

                                size="small"

                                label={c}

                                onDelete={() => removeAppliedCondition(c)}

                                sx={{ fontWeight: 600, ...conditionChipSx(c) }}

                              />

                            ))}

                            {appliedOfferLanguages.map((lang) => (

                              <Chip

                                key={`lang-${lang}`}

                                size="small"

                                label={<LanguageChipLabel lang={lang} flagWidth={16} />}

                                variant="outlined"

                                onDelete={() => removeAppliedLanguage(lang)}

                              />

                            ))}

                            {appliedOfferExtras.map((extraId) => (

                              <Chip

                                key={`extra-${extraId}`}

                                size="small"

                                label={extraFacetLabel(extraId)}

                                onDelete={() => removeAppliedExtra(extraId)}

                                sx={{ fontWeight: 600, ...extraChipSx(extraFacetLabel(extraId)) }}

                              />

                            ))}

                            {appliedMinUsd != null && (

                              <Chip size="small" label={`≥ $${appliedMinUsd}`} onDelete={() => setAppliedMinUsd(null)} />

                            )}

                            {appliedMaxUsd != null && (

                              <Chip size="small" label={`≤ $${appliedMaxUsd}`} onDelete={() => setAppliedMaxUsd(null)} />

                            )}

                          </Stack>

                        </Box>

                      )}



                      <Stack

                        direction="row"

                        spacing={1}

                        justifyContent="flex-end"

                        sx={{ px: 2, py: 1.25, bgcolor: "background.paper", borderTop: 1, borderColor: "divider" }}

                      >

                        <Button size="small" variant="text" color="inherit" onClick={clearOfferFilters}>

                          Limpiar

                        </Button>

                        <Button size="small" variant="contained" onClick={applyOfferFilters}>

                          Filtrar

                        </Button>

                      </Stack>

                    </Paper>



                    {offers.length === 0 ? (

                      <Alert severity="info">Ninguna oferta coincide con los filtros aplicados.</Alert>

                    ) : (

                      <TableContainer>

                        <Table size="small">

                          <TableHead>

                            <TableRow>

                              <TableCell>Precio</TableCell>

                              <TableCell>COP aprox.</TableCell>

                              <TableCell>PVP aprox.</TableCell>

                              <TableCell>Estado</TableCell>

                              <TableCell>Idioma</TableCell>

                              <TableCell>Extras</TableCell>

                              <TableCell>Stock</TableCell>

                              <TableCell align="right">Acción</TableCell>

                            </TableRow>

                          </TableHead>

                          <TableBody>

                            {offers.slice(0, 25).map((p) => {

                              const usd = productUsd(p);

                              const purchaseCop = copPerUsd != null ? usd * copPerUsd : null;

                              const pvp =

                                purchaseCop != null

                                  ? computeCardtraderUnitCostCop(purchaseCop).pvpApproxCop

                                  : null;

                              return (

                                <TableRow key={p.id} hover>

                                  <TableCell>{p.price?.formatted ?? `$${usd.toFixed(2)}`}</TableCell>

                                  <TableCell>

                                    {purchaseCop != null ? formatCOP(Math.round(purchaseCop)) : "—"}

                                  </TableCell>

                                  <TableCell>{pvp != null ? formatCOP(pvp) : "—"}</TableCell>

                                  <TableCell>{productConditionLabel(p)}</TableCell>

                                  <TableCell>{productLanguageLabel(p)}</TableCell>

                                  <TableCell>

                                    {(() => {

                                      const extras = productOfferExtraLabels(p);

                                      if (extras.length === 0) return "—";

                                      return (

                                        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>

                                          {extras.map((label) => (

                                            <Chip

                                              key={label}

                                              size="small"

                                              label={label}

                                              sx={{ height: 22, fontSize: "0.7rem", ...extraChipSx(label) }}

                                            />

                                          ))}

                                        </Stack>

                                      );

                                    })()}

                                  </TableCell>

                                  <TableCell>{p.quantity ?? 0}</TableCell>

                                  <TableCell align="right">

                                    <Button

                                      size="small"

                                      disabled={

                                        addMutation.isPending ||

                                        pedidoQtyToAddFromOffer(

                                          activeLine,

                                          addedQtyByLineId,

                                          p.quantity,

                                        ) <= 0

                                      }

                                      onClick={() => void addOfferToLine(activeLine, p)}

                                    >

                                      {(() => {

                                        const toAdd = pedidoQtyToAddFromOffer(

                                          activeLine,

                                          addedQtyByLineId,

                                          p.quantity,

                                        );

                                        const remaining = pedidoLineRemainingQty(

                                          activeLine,

                                          addedQtyByLineId,

                                        );

                                        if (toAdd <= 0) return "Sin stock";

                                        if (remaining <= 0) return `Añadir ${toAdd} extra`;

                                        return `Añadir ${toAdd}`;

                                      })()}

                                    </Button>

                                  </TableCell>

                                </TableRow>

                              );

                            })}

                          </TableBody>

                        </Table>

                      </TableContainer>

                    )}

                  </>

                )}

              </Stack>

            )}

          </Paper>

        </Stack>

      )}

      <QuoteManualSearchDialog

        open={manualSearchOpen}

        onClose={() => setManualSearchOpen(false)}

        onPick={(candidate) => {

          if (!activeLine) return;

          chooseCandidate(activeLine.id, candidate);

        }}

      />

    </Box>

  );

}


