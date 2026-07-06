import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  downloadCardtraderCartClientePdf,
  type CotizarCartPdfLine,
} from "./cardtrader-cotizar-cart-pdf";
import {
  fetchCartImageDataUrl,
  resolveCartThumbnailSrc,
  setMemoryCartImageDataUrl,
  upsertCardtraderCartMetaWithImage,
} from "../../utils/cardtrader-cart-image";
import { enrichCartMetaFromBlueprintBrowse } from "../../utils/cardtrader-cart-enrich";
import {
  buildCartMetaFromOffer,
  loadCardtraderCartMetaCache,
  mergeCartItemMeta,
  upsertCardtraderCartMeta,
  type CardtraderCartItemMeta,
} from "../../utils/cardtrader-cart-meta-cache";
import {
  LanguageChipLabel,
  LanguageFlag,
} from "../../utils/cardtrader-language-flags";
import {
  availableOfferExtraFacets,
  extraChipSx,
  extraFacetLabel,
  matchesOfferExtrasFilter,
  productOfferExtraLabels,
} from "../../utils/cardtrader-offer-extras";
import { formatCOP } from "../../utils/convert";
import { parseCopInput } from "../../utils/ct0-incoming-batch-draft";
import { resolveCartItemPricing } from "../../utils/cardtrader-cart-pricing";
import {
  blueprintMatchesPriceFilter,
  blueprintMatchesRarityFilter,
  compareBlueprintsByMarketPrice,
  extractBlueprintListPrice,
  extractBlueprintRarity,
  formatBlueprintMarketPrice,
  marketPriceToUsdCents,
  minPricesByBlueprintFromMarketplace,
  parseUsdFilterToCents,
  raritiesByBlueprintFromMarketplace,
  type BlueprintMarketPrice,
  type BlueprintPriceSort,
} from "../../utils/cardtrader-blueprint-market";
import {
  CARDTRADER_SHIPPING_COP_PER_UNIT,
  computeCardtraderUnitCostCop,
} from "../../utils/cardtrader-cotizar-pricing";
import { resolveUsdCopRate } from "../incoming/simulate-real-card-price";
import { useExchangeRates } from "../../utils/tasa";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Paper,
  Snackbar,
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

import { API_BASE } from "../../config/api";
const CARDTRADER_POKEMON_GAME_ID = 5;
const BLUEPRINTS_PER_PAGE = 96;
const OFFERS_PER_PAGE = 12;

type CtExpansion = {
  id: number;
  name?: string;
  name_en?: string;
  code?: string;
};

type CtBlueprint = {
  id: number;
  name?: string;
  name_en?: string;
  version?: string;
  fixed_properties?: {
    collector_number?: string;
    pokemon_rarity?: string;
    mtg_rarity?: string;
    rarity?: string;
  };
  image_url?: string | null;
};

type CtProduct = {
  id: number;
  name_en?: string;
  blueprint_id?: number;
  price?: { cents?: number; currency?: string; formatted?: string };
  quantity?: number;
  properties_hash?: Record<string, unknown>;
  user?: { username?: string; country_code?: string };
  on_vacation?: boolean;
};

type CartSubcart = {
  id?: number;
  seller?: { username?: string };
  subtotal?: { cents?: number; currency?: string };
  cart_items?: {
    quantity: number;
    price_cents?: number;
    price_currency?: string;
    product?: {
      id?: number;
      name_en?: string;
      marketplace_meta?: {
        blueprint_id?: number;
        expansion?: { name_en?: string; name?: string; code?: string; id?: number };
        properties_hash?: Record<string, unknown>;
        price?: { cents?: number; currency?: string; formatted?: string };
        image_url?: string | null;
      };
    };
  }[];
};

type CartResponse = {
  id?: number;
  subcarts?: CartSubcart[];
  subtotal?: { cents: number; currency: string };
  total?: { cents: number; currency: string };
  safeguard_fee_amount?: { cents: number; currency: string };
  ct_zero_fee_amount?: { cents: number; currency: string };
  payment_method_fee_fixed_amount?: { cents: number; currency: string };
  payment_method_fee_percentage_amount?: { cents: number; currency: string };
  shipping_cost?: { cents: number; currency: string };
};

type ShippingMethod = {
  max_estimate_shipping_days?: number | null;
};

type CartItemMeta = CardtraderCartItemMeta;

function normalizeExpansions(data: unknown): CtExpansion[] {
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is CtExpansion => x && typeof x === "object" && typeof x.id === "number",
    );
  }
  if (data && typeof data === "object" && "expansions" in data) {
    const inner = (data as { expansions: unknown }).expansions;
    return normalizeExpansions(inner);
  }
  return [];
}

function normalizeBlueprints(data: unknown): CtBlueprint[] {
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is CtBlueprint => x && typeof x === "object" && typeof (x as CtBlueprint).id === "number",
    );
  }
  return [];
}

function firstProductList(data: unknown): CtProduct[] {
  if (!data || typeof data !== "object") return [];
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      return v.filter(
        (x): x is CtProduct =>
          !!x && typeof x === "object" && typeof (x as CtProduct).id === "number",
      ) as CtProduct[];
    }
  }
  return [];
}

function nestErrorMessage(data: unknown, status: number | undefined, fallback: string): string {
  if (status === 503) {
    return "CardTrader no configurado en el servidor (CARDTRADER_API_TOKEN).";
  }
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.map(String).join(", ");
  }
  return fallback;
}

function moneyFromCents(cents: number | undefined, currency: string | undefined): string {
  return `${((cents ?? 0) / 100).toFixed(2)} ${currency ?? ""}`.trim();
}

function productConditionLabel(p: CtProduct): string {
  const raw =
    p.properties_hash?.condition ?? p.properties_hash?.pokemon_condition ?? "";
  return String(raw || "—");
}

function conditionChipSx(condition: string): { bgcolor: string; color: string } {
  const c = condition.toLowerCase();
  if (c.includes("near mint")) {
    return { bgcolor: "#2e7d32", color: "#fff" };
  }
  if (c.includes("poor")) {
    return { bgcolor: "#c62828", color: "#fff" };
  }
  if (
    c.includes("good") ||
    c.includes("lightly") ||
    c.includes("erately") ||
    c.includes("played") ||
    c.includes("moderate")
  ) {
    return { bgcolor: "#f9a825", color: "#1a1a1a" };
  }
  return { bgcolor: "#e0e0e0", color: "#424242" };
}

function rarityChipSx(rarity: string): { bgcolor: string; color: string } {
  const r = rarity.toLowerCase();
  if (r.includes("secret") || r.includes("hyper") || r.includes("illustration")) {
    return { bgcolor: "#6a1b9a", color: "#fff" };
  }
  if (r.includes("ultra") || r.includes("double") || r.includes("special")) {
    return { bgcolor: "#ef6c00", color: "#fff" };
  }
  if (r.includes("rare")) {
    return { bgcolor: "#f9a825", color: "#1a1a1a" };
  }
  if (r.includes("uncommon")) {
    return { bgcolor: "#546e7a", color: "#fff" };
  }
  if (r.includes("common")) {
    return { bgcolor: "#eceff1", color: "#37474f" };
  }
  return { bgcolor: "#e3f2fd", color: "#1565c0" };
}

function FilterGlyph() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: 18, height: 18, display: "block" }}
    >
      <path
        fill="currentColor"
        d="M4 5h16v1.6L14 13v5.4l-4 1.2V13L4 6.6V5z"
      />
    </Box>
  );
}

function arraysEqualSorted(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function OfferFilterFacet({
  hint,
  options,
  selected,
  onToggle,
  renderLabel,
  chipSxForValue,
  withFlagIcon,
}: {
  hint?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  renderLabel?: (value: string) => ReactNode;
  chipSxForValue?: (value: string) => Record<string, unknown> | undefined;
  /** Muestra bandera en icon del Chip (mejor en Windows que dentro del label). */
  withFlagIcon?: boolean;
}) {
  if (options.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {hint ?? "Sin opciones en el listado."}
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
      }}
    >
      {options.map((value) => {
        const isOn = selected.includes(value);
        const customSx = isOn ? chipSxForValue?.(value) : undefined;
        return (
          <Chip
            key={value}
            label={
              renderLabel
                ? renderLabel(value)
                : withFlagIcon
                  ? <LanguageChipLabel lang={value} flagWidth={18} />
                  : value
            }
            clickable
            onClick={() => onToggle(value)}
            variant={isOn ? "filled" : "outlined"}
            color={isOn && !customSx ? "primary" : "default"}
            sx={{
              fontWeight: isOn ? 600 : 500,
              borderRadius: 2,
              height: 32,
              bgcolor: isOn ? undefined : "background.paper",
              borderColor: isOn ? "transparent" : "divider",
              transition: "background-color 0.15s, box-shadow 0.15s",
              "& .MuiChip-icon": { ml: 0.25, mr: -0.25 },
              "& .MuiChip-label": { fontFamily: "inherit" },
              ...(isOn && customSx ? customSx : {}),
              "&:hover": {
                boxShadow: 1,
              },
            }}
          />
        );
      })}
    </Box>
  );
}

function SearchGlyph() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: 20, height: 20, color: "text.secondary", display: "block" }}
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M20 20l-4-4"
      />
    </Box>
  );
}

function productLangRaw(p: CtProduct): string | null {
  const props = p.properties_hash;
  const lang = props?.pokemon_language ?? props?.mtg_language ?? props?.language;
  return typeof lang === "string" && lang.trim() ? lang.trim() : null;
}

function productConditionValue(p: CtProduct): string | null {
  const raw = p.properties_hash?.condition ?? p.properties_hash?.pokemon_condition;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function productLanguageValue(p: CtProduct): string | null {
  const raw = productLangRaw(p);
  return raw ? raw.toLowerCase() : null;
}

function matchesOfferFilters(
  p: CtProduct,
  conditions: string[],
  languages: string[],
  extraFacetIds: string[] = [],
): boolean {
  if (conditions.length > 0) {
    const cond = productConditionValue(p);
    if (!cond || !conditions.includes(cond)) return false;
  }
  if (languages.length > 0) {
    const lang = productLanguageValue(p);
    if (!lang || !languages.includes(lang)) return false;
  }
  if (extraFacetIds.length > 0 && !matchesOfferExtrasFilter(p, extraFacetIds)) {
    return false;
  }
  return true;
}

function cartLines(cart: CartResponse | null | undefined): {
  key: string;
  productId: number;
  name: string;
  qty: number;
  priceCents: number;
  lineTotalCents: number;
  currency: string;
  priceLabel: string;
  lineTotalLabel: string;
  meta?: CartItemMeta;
}[] {
  if (!cart?.subcarts?.length) return [];
  const lines: {
    key: string;
    productId: number;
    name: string;
    qty: number;
    priceCents: number;
    lineTotalCents: number;
    currency: string;
    priceLabel: string;
    lineTotalLabel: string;
    meta?: CartItemMeta;
  }[] = [];
  const cartSubtotalCents = cart.subtotal?.cents;

  cart.subcarts.forEach((sc, si) => {
    const subcartItems =
      sc.cart_items?.map((ci) => ({
        priceCents: ci.price_cents ?? 0,
        quantity: Math.max(1, ci.quantity ?? 1),
      })) ?? [];
    const subcartSubtotalCents = sc.subtotal?.cents;

    sc.cart_items?.forEach((ci, ii) => {
      const rawId = ci.product?.id;
      const pid =
        typeof rawId === "number"
          ? rawId
          : typeof rawId === "string"
            ? Number(rawId)
            : NaN;
      if (!Number.isFinite(pid)) return;
      const rawCents = ci.price_cents ?? 0;
      const qty = Math.max(1, ci.quantity ?? 1);
      const cur = ci.price_currency ?? "";
      const meta = ci.product?.marketplace_meta;
      const props = meta?.properties_hash;
      const blueprintId =
        typeof meta?.blueprint_id === "number" ? meta.blueprint_id : undefined;
      const collectorFromProps =
        typeof props?.collector_number === "string"
          ? props.collector_number
          : typeof props?.number === "string"
            ? props.number
            : undefined;
      const pricing = resolveCartItemPricing({
        priceCents: rawCents,
        quantity: qty,
        subcartItems,
        subcartSubtotalCents,
        cartSubtotalCents,
      });
      const { unitCents, lineTotalCents } = pricing;
      lines.push({
        key: `${si}-${ii}-${pid}`,
        productId: pid,
        name: ci.product?.name_en ?? `Producto ${pid}`,
        qty,
        priceCents: unitCents,
        lineTotalCents,
        currency: cur,
        priceLabel: `${unitCents / 100} ${cur}`.trim(),
        lineTotalLabel: `${lineTotalCents / 100} ${cur}`.trim(),
        meta: {
          expansion:
            meta?.expansion?.name_en ?? meta?.expansion?.name ?? meta?.expansion?.code ?? undefined,
          condition: typeof props?.condition === "string" ? props.condition : undefined,
          language:
            typeof (props?.pokemon_language ?? props?.mtg_language) === "string"
              ? String(props?.pokemon_language ?? props?.mtg_language).toUpperCase()
              : undefined,
          collectorNumber: collectorFromProps?.trim() || undefined,
          blueprintId,
          imageUrl:
            typeof meta?.image_url === "string" && meta.image_url.trim()
              ? meta.image_url.trim()
              : undefined,
        },
      });
    });
  });
  return lines;
}

function resolveCartLineImageUrl(
  productId: number,
  meta: CartItemMeta | undefined,
  productMetaById: Record<number, CartItemMeta>,
  blueprintImageById: Record<number, string>,
): string | undefined {
  const cached = productMetaById[productId];
  const direct = cached?.imageUrl ?? meta?.imageUrl;
  if (direct?.trim()) return direct.trim();
  const blueprintId = cached?.blueprintId ?? meta?.blueprintId;
  if (typeof blueprintId === "number") {
    const fromBlueprint = blueprintImageById[blueprintId];
    if (fromBlueprint) return fromBlueprint;
  }
  return undefined;
}

function purchaseCopPerUnit(
  priceCents: number,
  currency: string,
  convert: ReturnType<typeof useExchangeRates>["convert"],
  copPerUsd: number | null,
): number | null {
  const amount = priceCents / 100;
  const cur = currency.trim().toUpperCase() || "USD";
  if (cur === "USD") {
    if (copPerUsd === null || copPerUsd <= 0) return null;
    return amount * copPerUsd;
  }
  if (cur === "EUR") return convert.toCopFromEur(amount);
  if (cur === "COP") return amount;
  return convert.toCopFromUsd(amount);
}

function centsToCop(
  cents: number,
  currency: string | undefined,
  convert: ReturnType<typeof useExchangeRates>["convert"],
  copPerUsd: number | null,
): number | null {
  if (!Number.isFinite(cents)) return null;
  return purchaseCopPerUnit(cents, currency?.trim() || "USD", convert, copPerUsd);
}

function CopPriceRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: number;
  emphasized?: "primary" | "default";
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.25 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="caption"
        fontWeight={emphasized ? 700 : 600}
        color={emphasized === "primary" ? "primary.main" : "text.primary"}
      >
        {formatCOP(Math.round(value))}
      </Typography>
    </Stack>
  );
}

export default function CotizarCardtraderPage() {
  const queryClient = useQueryClient();
  const { convert, rates, isPrompting, handleSaveRates } = useExchangeRates();
  const [rateInputs, setRateInputs] = useState({
    euroToCop: "",
    usdToCop: "",
    usdToEur: "",
  });
  const [expansion, setExpansion] = useState<CtExpansion | null>(null);
  const [blueprint, setBlueprint] = useState<CtBlueprint | null>(null);
  const [blueprintFilter, setBlueprintFilter] = useState("");
  const [draftBlueprintPriceMinUsd, setDraftBlueprintPriceMinUsd] = useState("");
  const [draftBlueprintPriceMaxUsd, setDraftBlueprintPriceMaxUsd] = useState("");
  const [appliedBlueprintPriceMinUsd, setAppliedBlueprintPriceMinUsd] = useState("");
  const [appliedBlueprintPriceMaxUsd, setAppliedBlueprintPriceMaxUsd] = useState("");
  const [draftBlueprintRarities, setDraftBlueprintRarities] = useState<string[]>([]);
  const [appliedBlueprintRarities, setAppliedBlueprintRarities] = useState<string[]>([]);
  const [blueprintPriceSort, setBlueprintPriceSort] = useState<BlueprintPriceSort>("asc");
  const [blueprintPage, setBlueprintPage] = useState(1);
  const [offersPage, setOffersPage] = useState(1);
  const [draftOfferConditions, setDraftOfferConditions] = useState<string[]>([]);
  const [draftOfferLanguages, setDraftOfferLanguages] = useState<string[]>([]);
  const [appliedOfferConditions, setAppliedOfferConditions] = useState<string[]>([]);
  const [appliedOfferLanguages, setAppliedOfferLanguages] = useState<string[]>([]);
  const [draftOfferExtras, setDraftOfferExtras] = useState<string[]>([]);
  const [appliedOfferExtras, setAppliedOfferExtras] = useState<string[]>([]);
  const [viaZero, setViaZero] = useState(true);
  const [productMetaById, setProductMetaById] = useState<Record<number, CartItemMeta>>(() =>
    loadCardtraderCartMetaCache(),
  );
  const [exportingCartPdf, setExportingCartPdf] = useState(false);
  const [exportingCartPvpPropioPdf, setExportingCartPvpPropioPdf] = useState(false);
  const [pvpPropioDraftById, setPvpPropioDraftById] = useState<Record<number, string>>({});
  const [snack, setSnack] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const expansionsQuery = useQuery({
    queryKey: ["cardtrader", "expansions", CARDTRADER_POKEMON_GAME_ID],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/expansions`, {
        params: { game_id: CARDTRADER_POKEMON_GAME_ID },
      });
      return res.data as unknown;
    },
  });

  const expansions = useMemo(
    () => normalizeExpansions(expansionsQuery.data),
    [expansionsQuery.data],
  );

  const blueprintsQuery = useQuery({
    queryKey: ["cardtrader", "blueprints", expansion?.id],
    enabled: !!expansion?.id,
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/blueprints`, {
        params: { expansion_id: expansion!.id },
      });
      return res.data as unknown;
    },
  });

  const expansionMarketQuery = useQuery({
    queryKey: ["cardtrader", "marketplace", "expansion", expansion?.id],
    enabled: !!expansion?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/marketplace/products`, {
        params: { expansion_id: expansion!.id },
      });
      return res.data as unknown;
    },
  });

  const blueprints = useMemo(
    () => normalizeBlueprints(blueprintsQuery.data),
    [blueprintsQuery.data],
  );

  const blueprintMinPrices = useMemo(() => {
    const map = minPricesByBlueprintFromMarketplace(expansionMarketQuery.data);
    for (const bp of blueprints) {
      if (map.has(bp.id)) continue;
      const fromBlueprint = extractBlueprintListPrice(bp);
      if (fromBlueprint) map.set(bp.id, fromBlueprint);
    }
    return map;
  }, [expansionMarketQuery.data, blueprints]);

  const blueprintImageById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const bp of blueprints) {
      if (typeof bp.id === "number" && bp.image_url?.trim()) {
        map[bp.id] = bp.image_url.trim();
      }
    }
    return map;
  }, [blueprints]);

  const copPerUsd = useMemo(() => {
    if (rates.usdToCop === null || rates.usdToCop <= 0) return null;
    return resolveUsdCopRate(rates.usdToCop).copPerUsd;
  }, [rates.usdToCop]);

  const blueprintRarityById = useMemo(() => {
    const map = new Map<number, string>();
    for (const bp of blueprints) {
      const fromBlueprint = extractBlueprintRarity(bp);
      if (fromBlueprint) map.set(bp.id, fromBlueprint);
    }
    for (const [id, rarity] of raritiesByBlueprintFromMarketplace(expansionMarketQuery.data)) {
      if (!map.has(id)) map.set(id, rarity);
    }
    return map;
  }, [blueprints, expansionMarketQuery.data]);

  const availableBlueprintRarities = useMemo(() => {
    const set = new Set<string>();
    for (const rarity of blueprintRarityById.values()) {
      set.add(rarity);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [blueprintRarityById]);

  const blueprintUsdCentsById = useMemo(() => {
    const map = new Map<number, number>();
    for (const [id, price] of blueprintMinPrices) {
      const usd = marketPriceToUsdCents(price, copPerUsd, convert);
      if (usd !== null) map.set(id, usd);
    }
    return map;
  }, [blueprintMinPrices, copPerUsd, convert]);

  const resetBlueprintCatalogFilters = useCallback(() => {
    setDraftBlueprintPriceMinUsd("");
    setDraftBlueprintPriceMaxUsd("");
    setAppliedBlueprintPriceMinUsd("");
    setAppliedBlueprintPriceMaxUsd("");
    setDraftBlueprintRarities([]);
    setAppliedBlueprintRarities([]);
    setBlueprintPriceSort("asc");
  }, []);

  const clearBlueprintCatalogFilters = useCallback(() => {
    resetBlueprintCatalogFilters();
    setBlueprintPage(1);
  }, [resetBlueprintCatalogFilters]);

  const applyBlueprintCatalogFilters = useCallback(() => {
    setAppliedBlueprintPriceMinUsd(draftBlueprintPriceMinUsd);
    setAppliedBlueprintPriceMaxUsd(draftBlueprintPriceMaxUsd);
    setAppliedBlueprintRarities([...draftBlueprintRarities]);
    setBlueprintPage(1);
  }, [draftBlueprintPriceMinUsd, draftBlueprintPriceMaxUsd, draftBlueprintRarities]);

  const blueprintCatalogFiltersPending = useMemo(
    () =>
      draftBlueprintPriceMinUsd !== appliedBlueprintPriceMinUsd ||
      draftBlueprintPriceMaxUsd !== appliedBlueprintPriceMaxUsd ||
      !arraysEqualSorted(draftBlueprintRarities, appliedBlueprintRarities),
    [
      draftBlueprintPriceMinUsd,
      appliedBlueprintPriceMinUsd,
      draftBlueprintPriceMaxUsd,
      appliedBlueprintPriceMaxUsd,
      draftBlueprintRarities,
      appliedBlueprintRarities,
    ],
  );

  const toggleDraftBlueprintRarity = useCallback((value: string) => {
    setDraftBlueprintRarities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const filteredBlueprints = useMemo(() => {
    const q = blueprintFilter.trim().toLowerCase();
    const minUsdCents = parseUsdFilterToCents(appliedBlueprintPriceMinUsd);
    const maxUsdCents = parseUsdFilterToCents(appliedBlueprintPriceMaxUsd);

    const list = blueprints.filter((bp) => {
      const name = (bp.name_en ?? bp.name ?? "").toLowerCase();
      if (q && !name.includes(q) && !String(bp.id).includes(q)) return false;

      const usdCents = blueprintUsdCentsById.get(bp.id) ?? null;
      if (!blueprintMatchesPriceFilter(usdCents, minUsdCents, maxUsdCents)) return false;

      const rarity = blueprintRarityById.get(bp.id);
      if (!blueprintMatchesRarityFilter(rarity, appliedBlueprintRarities)) return false;

      return true;
    });

    list.sort((a, b) => {
      const nameA = a.name_en ?? a.name ?? `#${a.id}`;
      const nameB = b.name_en ?? b.name ?? `#${b.id}`;
      if (blueprintMinPrices.size > 0 || blueprintUsdCentsById.size > 0) {
        return compareBlueprintsByMarketPrice(a.id, b.id, blueprintMinPrices, nameA, nameB, {
          direction: blueprintPriceSort,
          usdCentsByBlueprintId: blueprintUsdCentsById,
          copPerUsd,
          convert,
        });
      }
      return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    });
    return list;
  }, [
    blueprints,
    blueprintFilter,
    blueprintMinPrices,
    blueprintUsdCentsById,
    blueprintRarityById,
    appliedBlueprintPriceMinUsd,
    appliedBlueprintPriceMaxUsd,
    appliedBlueprintRarities,
    blueprintPriceSort,
    copPerUsd,
    convert,
  ]);

  const totalBlueprintPages = Math.max(
    1,
    Math.ceil(filteredBlueprints.length / BLUEPRINTS_PER_PAGE),
  );
  const currentBlueprintPage = Math.min(blueprintPage, totalBlueprintPages);
  const visibleBlueprints = useMemo(() => {
    const start = (currentBlueprintPage - 1) * BLUEPRINTS_PER_PAGE;
    return filteredBlueprints.slice(start, start + BLUEPRINTS_PER_PAGE);
  }, [filteredBlueprints, currentBlueprintPage]);

  const productsQuery = useQuery({
    queryKey: [
      "cardtrader",
      "products",
      blueprint?.id,
      appliedOfferLanguages.length === 1 ? appliedOfferLanguages[0] : "all-langs",
    ],
    enabled: !!blueprint?.id,
    queryFn: async () => {
      const params: Record<string, string | number> = {
        blueprint_id: blueprint!.id,
      };
      if (appliedOfferLanguages.length === 1) {
        params.language = appliedOfferLanguages[0];
      }
      const res = await axios.get(`${API_BASE}/cardtrader/marketplace/products`, {
        params,
      });
      return res.data as unknown;
    },
  });

  const marketplaceProducts = useMemo(
    () => (blueprint ? firstProductList(productsQuery.data) : []),
    [blueprint, productsQuery.data],
  );

  const availableConditions = useMemo(() => {
    const set = new Set<string>();
    for (const p of marketplaceProducts) {
      const condition = productConditionValue(p);
      if (condition) set.add(condition);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [marketplaceProducts]);

  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    for (const p of marketplaceProducts) {
      const language = productLanguageValue(p);
      if (language) set.add(language);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [marketplaceProducts]);

  const availableExtras = useMemo(
    () => availableOfferExtraFacets(marketplaceProducts),
    [marketplaceProducts],
  );

  const products = useMemo(() => {
    if (!blueprint) return [];
    return marketplaceProducts.filter((p) =>
      matchesOfferFilters(
        p,
        appliedOfferConditions,
        appliedOfferLanguages,
        appliedOfferExtras,
      ),
    );
  }, [
    blueprint,
    marketplaceProducts,
    appliedOfferConditions,
    appliedOfferLanguages,
    appliedOfferExtras,
  ]);

  const applyOfferFilters = useCallback(() => {
    setAppliedOfferConditions([...draftOfferConditions]);
    setAppliedOfferLanguages([...draftOfferLanguages]);
    setAppliedOfferExtras([...draftOfferExtras]);
    setOffersPage(1);
  }, [draftOfferConditions, draftOfferLanguages, draftOfferExtras]);

  const clearOfferFilters = useCallback(() => {
    setDraftOfferConditions([]);
    setDraftOfferLanguages([]);
    setDraftOfferExtras([]);
    setAppliedOfferConditions([]);
    setAppliedOfferLanguages([]);
    setAppliedOfferExtras([]);
    setOffersPage(1);
  }, []);

  const offerFiltersPending = useMemo(
    () =>
      !arraysEqualSorted(draftOfferConditions, appliedOfferConditions) ||
      !arraysEqualSorted(draftOfferLanguages, appliedOfferLanguages) ||
      !arraysEqualSorted(draftOfferExtras, appliedOfferExtras),
    [
      draftOfferConditions,
      appliedOfferConditions,
      draftOfferLanguages,
      appliedOfferLanguages,
      draftOfferExtras,
      appliedOfferExtras,
    ],
  );

  const toggleDraftCondition = useCallback((value: string) => {
    setDraftOfferConditions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const toggleDraftLanguage = useCallback((value: string) => {
    setDraftOfferLanguages((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const removeAppliedCondition = useCallback((value: string) => {
    const next = appliedOfferConditions.filter((v) => v !== value);
    setAppliedOfferConditions(next);
    setDraftOfferConditions(next);
    setOffersPage(1);
  }, [appliedOfferConditions]);

  const removeAppliedLanguage = useCallback((value: string) => {
    const next = appliedOfferLanguages.filter((v) => v !== value);
    setAppliedOfferLanguages(next);
    setDraftOfferLanguages(next);
    setOffersPage(1);
  }, [appliedOfferLanguages]);

  const toggleDraftExtra = useCallback((value: string) => {
    setDraftOfferExtras((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const removeAppliedExtra = useCallback((value: string) => {
    const next = appliedOfferExtras.filter((v) => v !== value);
    setAppliedOfferExtras(next);
    setDraftOfferExtras(next);
    setOffersPage(1);
  }, [appliedOfferExtras]);

  const resetOfferFilters = useCallback(() => {
    setDraftOfferConditions([]);
    setDraftOfferLanguages([]);
    setDraftOfferExtras([]);
    setAppliedOfferConditions([]);
    setAppliedOfferLanguages([]);
    setAppliedOfferExtras([]);
  }, []);
  const sellerUsernames = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => p.user?.username?.trim())
            .filter((u): u is string => !!u),
        ),
      ),
    [products],
  );
  const shippingQuery = useQuery({
    queryKey: ["cardtrader", "shipping", ...sellerUsernames.sort()],
    enabled: sellerUsernames.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        sellerUsernames.map(async (username) => {
          const res = await axios.get(`${API_BASE}/cardtrader/shipping-methods`, {
            params: { username },
          });
          const methods = Array.isArray(res.data)
            ? (res.data as ShippingMethod[])
            : [];
          const days = methods
            .map((m) => m.max_estimate_shipping_days)
            .filter((d): d is number => typeof d === "number" && d > 0);
          const minDays = days.length ? Math.min(...days) : undefined;
          return [username, minDays] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number | undefined>;
    },
  });
  const offersTotalPages = Math.max(1, Math.ceil(products.length / OFFERS_PER_PAGE));
  const currentOffersPage = Math.min(offersPage, offersTotalPages);
  const visibleProducts = useMemo(() => {
    const start = (currentOffersPage - 1) * OFFERS_PER_PAGE;
    return products.slice(start, start + OFFERS_PER_PAGE);
  }, [products, currentOffersPage]);

  const cartQuery = useQuery({
    queryKey: ["cardtrader", "cart"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/cart`);
      return res.data as CartResponse;
    },
    refetchOnWindowFocus: true,
  });

  const invalidateCart = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["cardtrader", "cart"] });
  }, [queryClient]);

  const persistCartMeta = useCallback((productId: number, meta: CartItemMeta) => {
    const merged = upsertCardtraderCartMeta(productId, meta);
    setProductMetaById((prev) => ({ ...prev, [productId]: merged }));
    return merged;
  }, []);

  useEffect(() => {
    if (!cartQuery.data) return;
    const cartLinesList = cartLines(cartQuery.data);
    if (!cartLinesList.length) return;

    const stored = loadCardtraderCartMetaCache();
    const updates: Record<number, CartItemMeta> = {};

    for (const line of cartLinesList) {
      const existing = stored[line.productId];
      const blueprintId = line.meta?.blueprintId ?? existing?.blueprintId;
      const imageFromBlueprint =
        typeof blueprintId === "number" ? blueprintImageById[blueprintId] : undefined;
      const merged = mergeCartItemMeta(existing, {
        ...line.meta,
        name: line.name,
        blueprintId,
        imageUrl: existing?.imageUrl ?? line.meta?.imageUrl ?? imageFromBlueprint,
      });
      updates[line.productId] = upsertCardtraderCartMeta(line.productId, merged);
    }

    setProductMetaById((prev) => {
      const next = { ...prev };
      for (const [id, meta] of Object.entries(updates)) {
        const productId = Number(id);
        if (!Number.isFinite(productId)) continue;
        next[productId] = mergeCartItemMeta(prev[productId], meta);
      }
      return next;
    });
  }, [cartQuery.data, blueprintImageById]);

  useEffect(() => {
    if (!blueprint || !cartQuery.data) return;
    let cancelled = false;

    void (async () => {
      const updates = await enrichCartMetaFromBlueprintBrowse({
        cart: cartQuery.data,
        blueprint,
        expansion,
        marketplaceProducts,
        blueprintImageUrl: blueprintImageById[blueprint.id],
        apiBase: API_BASE,
      });
      if (cancelled || !Object.keys(updates).length) return;

      setProductMetaById((prev) => {
        const next = { ...prev };
        for (const [id, meta] of Object.entries(updates)) {
          const productId = Number(id);
          if (!Number.isFinite(productId)) continue;
          next[productId] = meta;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    blueprint,
    cartQuery.data,
    marketplaceProducts,
    expansion,
    blueprintImageById,
  ]);

  const addMutation = useMutation({
    mutationFn: async (payload: {
      product_id: number;
      quantity: number;
      meta?: CartItemMeta;
    }) => {
      await axios.post(`${API_BASE}/cardtrader/cart/items`, {
        product_id: payload.product_id,
        quantity: payload.quantity,
        via_cardtrader_zero: viaZero,
      });
      return payload;
    },
    onSuccess: async (payload) => {
      if (payload.meta) {
        const merged = await upsertCardtraderCartMetaWithImage(
          payload.product_id,
          payload.meta,
          API_BASE,
        );
        setProductMetaById((prev) => ({ ...prev, [payload.product_id]: merged }));
      }
      setSnack({ msg: "Añadido al carrito CardTrader", severity: "success" });
      invalidateCart();
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e)
        ? nestErrorMessage(e.response?.data, e.response?.status, e.message)
        : "Error al añadir al carrito";
      setSnack({ msg, severity: "error" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (payload: { product_id: number; quantity: number }) => {
      await axios.post(`${API_BASE}/cardtrader/cart/items/remove`, payload);
    },
    onSuccess: () => {
      setSnack({ msg: "Carrito actualizado", severity: "success" });
      invalidateCart();
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e)
        ? nestErrorMessage(e.response?.data, e.response?.status, e.message)
        : "Error al quitar del carrito";
      setSnack({ msg, severity: "error" });
    },
  });

  const adjustCartQuantity = useCallback(
    async (productId: number, currentQty: number, nextQty: number) => {
      const safeNext = Math.max(0, Math.min(99, Math.floor(nextQty)));
      const delta = safeNext - currentQty;
      if (delta === 0) return;
      if (delta > 0) {
        const offer = products.find((p) => p.id === productId);
        const meta = offer
          ? buildCartMetaFromOffer({
              product: offer,
              blueprint,
              expansion,
              blueprintImageUrl:
                blueprint?.id !== undefined
                  ? blueprintImageById[blueprint.id]
                  : undefined,
            })
          : productMetaById[productId];
        if (meta) persistCartMeta(productId, meta);

        await axios.post(`${API_BASE}/cardtrader/cart/items`, {
          product_id: productId,
          quantity: delta,
          via_cardtrader_zero: viaZero,
        });
      } else {
        await axios.post(`${API_BASE}/cardtrader/cart/items/remove`, {
          product_id: productId,
          quantity: Math.abs(delta),
        });
      }
      invalidateCart();
    },
    [
      invalidateCart,
      viaZero,
      products,
      blueprint,
      expansion,
      blueprintImageById,
      productMetaById,
      persistCartMeta,
    ],
  );

  const lines = useMemo(() => {
    // Preferimos meta directamente desde el carrito (backend enriquecido).
    // Si no llega, usamos el cache local como fallback.
    return cartLines(cartQuery.data).map((line) => {
      const meta = mergeCartItemMeta(
        productMetaById[line.productId],
        line.meta ?? {},
      );
      return {
        ...line,
        name: meta.name?.trim() || line.name,
        meta,
      };
    });
  }, [cartQuery.data, productMetaById]);

  const lineUnitCosts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCardtraderUnitCostCop> | null>();
    for (const ln of lines) {
      const purchaseCop = purchaseCopPerUnit(
        ln.priceCents,
        ln.currency,
        convert,
        copPerUsd,
      );
      map.set(
        ln.key,
        purchaseCop === null ? null : computeCardtraderUnitCostCop(purchaseCop),
      );
    }
    return map;
  }, [lines, convert, copPerUsd]);

  const cartCopTotals = useMemo(() => {
    let purchaseCop = 0;
    let purchasePlusShippingCop = 0;
    let ivaPlusShippingCop = 0;
    let realCostCop = 0;
    let pvpApproxCop = 0;
    let hasAny = false;
    for (const ln of lines) {
      const unit = lineUnitCosts.get(ln.key);
      if (!unit) continue;
      hasAny = true;
      const q = Math.max(1, ln.qty);
      purchaseCop += unit.purchaseCop * q;
      purchasePlusShippingCop += unit.subtotalBeforeIva * q;
      ivaPlusShippingCop += unit.ivaPlusShippingCop * q;
      realCostCop += unit.realCostCop * q;
      pvpApproxCop += unit.pvpApproxCop * q;
    }
    return {
      purchaseCop: hasAny ? purchaseCop : null,
      purchasePlusShippingCop: hasAny ? purchasePlusShippingCop : null,
      ivaPlusShippingCop: hasAny ? ivaPlusShippingCop : null,
      realCostCop: hasAny ? realCostCop : null,
      pvpApproxCop: hasAny ? pvpApproxCop : null,
    };
  }, [lines, lineUnitCosts]);

  const hasAnyPvpPropio = useMemo(
    () =>
      lines.some((ln) => {
        const v = ln.meta?.pvpPropioCop;
        return typeof v === "number" && v > 0;
      }),
    [lines],
  );

  const cartPvpPropioTotal = useMemo(() => {
    if (!hasAnyPvpPropio) return null;
    let total = 0;
    let hasAny = false;
    for (const ln of lines) {
      const custom = ln.meta?.pvpPropioCop;
      if (typeof custom !== "number" || custom <= 0) continue;
      hasAny = true;
      total += custom * Math.max(1, ln.qty);
    }
    return hasAny ? total : null;
  }, [lines, hasAnyPvpPropio]);

  const commitPvpPropio = useCallback(
    (productId: number, raw: string) => {
      setPvpPropioDraftById((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      if (!raw.trim()) {
        persistCartMeta(productId, { pvpPropioCop: undefined });
        return;
      }
      const parsed = parseCopInput(raw);
      if (parsed !== null) {
        persistCartMeta(productId, { pvpPropioCop: Math.round(parsed) });
      }
    },
    [persistCartMeta],
  );

  const buildCartPdfLines = useCallback(
    async (
      resolveUnitPvpCop: (
        unit: NonNullable<ReturnType<typeof computeCardtraderUnitCostCop>>,
        meta: CartItemMeta,
      ) => number | null,
    ): Promise<CotizarCartPdfLine[]> => {
      const pdfLines: CotizarCartPdfLine[] = [];
      for (const ln of lines) {
        const unit = lineUnitCosts.get(ln.key);
        if (!unit) continue;
        const meta = mergeCartItemMeta(productMetaById[ln.productId], ln.meta ?? {});
        const pvpUnitCop = resolveUnitPvpCop(unit, meta);
        if (pvpUnitCop === null || pvpUnitCop <= 0) continue;

        const qty = Math.max(1, ln.qty);
        const imageUrl =
          meta.imageUrl ??
          resolveCartLineImageUrl(ln.productId, meta, productMetaById, blueprintImageById);

        let imageDataUrl = meta.imageDataUrl;
        if (!imageDataUrl?.startsWith("data:") && imageUrl) {
          imageDataUrl =
            (await fetchCartImageDataUrl(imageUrl, API_BASE)) ?? undefined;
          if (imageDataUrl) {
            persistCartMeta(ln.productId, { imageDataUrl });
          }
        }

        pdfLines.push({
          productId: ln.productId,
          name: meta.name?.trim() || ln.name,
          imageUrl,
          imageDataUrl,
          qty,
          pvpUnitCop,
          pvpLineCop: pvpUnitCop * qty,
          meta: {
            expansion: meta.expansion,
            condition: meta.condition,
            language: meta.language,
            collectorNumber: meta.collectorNumber,
            rarity: meta.rarity,
          },
        });
      }
      return pdfLines;
    },
    [lines, lineUnitCosts, productMetaById, blueprintImageById, persistCartMeta],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const ln of lines) {
        const meta = ln.meta;
        if (!meta?.imageUrl?.trim() || meta.imageDataUrl?.startsWith("data:")) continue;
        const dataUrl = await fetchCartImageDataUrl(meta.imageUrl, API_BASE);
        if (cancelled || !dataUrl) continue;
        setMemoryCartImageDataUrl(ln.productId, dataUrl);
        persistCartMeta(ln.productId, { imageDataUrl: dataUrl });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, persistCartMeta]);

  const handleExportCartClientePdf = useCallback(async () => {
    if (copPerUsd === null) {
      setSnack({
        msg: "Configura la tasa USD→COP para calcular el PVP del PDF.",
        severity: "error",
      });
      return;
    }

    const pdfLines = await buildCartPdfLines((unit) => unit.pvpApproxCop);

    if (pdfLines.length === 0) {
      setSnack({
        msg: "No hay líneas con PVP calculable para exportar.",
        severity: "error",
      });
      return;
    }

    setExportingCartPdf(true);
    try {
      const { imageFailures } = await downloadCardtraderCartClientePdf({
        lines: pdfLines,
        apiBase: API_BASE,
        title: "Cotización (PVP propuesto)",
        totalLabel: "PVP total (propuesto):",
      });
      setSnack({
        msg:
          imageFailures > 0
            ? `PDF generado (${imageFailures} imagen${imageFailures === 1 ? "" : "es"} sin cargar).`
            : "PDF con PVP propuesto exportado.",
        severity: "success",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "No se pudo generar el PDF.";
      setSnack({ msg, severity: "error" });
    } finally {
      setExportingCartPdf(false);
    }
  }, [buildCartPdfLines, copPerUsd]);

  const handleExportCartPvpPropioPdf = useCallback(async () => {
    if (!hasAnyPvpPropio) {
      setSnack({
        msg: "Ingresa al menos un PVP propio en el carrito para exportar precios especiales.",
        severity: "error",
      });
      return;
    }

    const pdfLines = await buildCartPdfLines((_unit, meta) => {
      const custom = meta.pvpPropioCop;
      return typeof custom === "number" && custom > 0 ? custom : null;
    });

    if (pdfLines.length === 0) {
      setSnack({
        msg: "No hay líneas con PVP propio válido para exportar.",
        severity: "error",
      });
      return;
    }

    setExportingCartPvpPropioPdf(true);
    try {
      const { imageFailures } = await downloadCardtraderCartClientePdf({
        lines: pdfLines,
        apiBase: API_BASE,
        title: "Cotización (precios especiales)",
        totalLabel: "PVP total (propio):",
        filenameSuffix: "pvp-propio",
      });
      setSnack({
        msg:
          imageFailures > 0
            ? `PDF generado (${imageFailures} imagen${imageFailures === 1 ? "" : "es"} sin cargar).`
            : "PDF con PVP propio exportado.",
        severity: "success",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "No se pudo generar el PDF.";
      setSnack({ msg, severity: "error" });
    } finally {
      setExportingCartPvpPropioPdf(false);
    }
  }, [buildCartPdfLines, hasAnyPvpPropio]);

  const configError =
    axios.isAxiosError(expansionsQuery.error) && expansionsQuery.error.response?.status === 503;
  const subtotalCents = cartQuery.data?.subtotal?.cents ?? 0;
  const feeCents =
    (cartQuery.data?.safeguard_fee_amount?.cents ?? 0) +
    (cartQuery.data?.ct_zero_fee_amount?.cents ?? 0) +
    (cartQuery.data?.payment_method_fee_fixed_amount?.cents ?? 0) +
    (cartQuery.data?.payment_method_fee_percentage_amount?.cents ?? 0);
  const shippingCents = cartQuery.data?.shipping_cost?.cents ?? 0;
  const grandTotalCents = subtotalCents + feeCents + shippingCents;
  const currency =
    cartQuery.data?.total?.currency ??
    cartQuery.data?.subtotal?.currency ??
    cartQuery.data?.shipping_cost?.currency;

  const feesCop = useMemo(
    () => centsToCop(feeCents, currency, convert, copPerUsd),
    [feeCents, currency, convert, copPerUsd],
  );
  const ctShippingCop = useMemo(
    () => centsToCop(shippingCents, currency, convert, copPerUsd),
    [shippingCents, currency, convert, copPerUsd],
  );

  return (
    <Box
      className="p-4"
      sx={{
        minHeight: "100%",
        bgcolor: "grey.50",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          borderRadius: 2.5,
          bgcolor: "background.paper",
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
          Cotizar (CardTrader)
        </Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ md: "flex-start" }}
        >
          <Box sx={{ width: { xs: "100%", md: "30%" }, minWidth: { md: 220 } }}>
            {expansionsQuery.isLoading ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Cargando expansiones…
                </Typography>
              </Stack>
            ) : expansionsQuery.isError ? (
              <Alert severity="error" sx={{ py: 0 }}>
                No se pudieron cargar expansiones.
              </Alert>
            ) : (
              <Autocomplete
                options={expansions}
                value={expansion}
                onChange={(_, v) => {
                  setExpansion(v);
                  setBlueprint(null);
                  setBlueprintFilter("");
                  resetBlueprintCatalogFilters();
                  setBlueprintPage(1);
                  setOffersPage(1);
                }}
                getOptionLabel={(o) => o.name_en ?? o.name ?? o.code ?? String(o.id)}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Expansión"
                    placeholder="Seleccionar…"
                    size="medium"
                  />
                )}
                slotProps={{
                  paper: { sx: { maxHeight: 320 } },
                }}
              />
            )}
          </Box>
          <Box sx={{ flex: 1, width: "100%" }}>
            <TextField
              fullWidth
              label="Buscar carta por nombre o ID"
              placeholder={expansion ? "Ej. Articuno" : "Elige una expansión primero"}
              value={blueprintFilter}
              disabled={!expansion}
              onChange={(e) => {
                setBlueprintFilter(e.target.value);
                setBlueprintPage(1);
              }}
              size="medium"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchGlyph />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Stack>
      </Paper>

      {configError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          El backend no tiene configurado <code>CARDTRADER_API_TOKEN</code>. Define la variable de
          entorno y reinicia Nest.
        </Alert>
      )}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Stack spacing={2}>
            {expansion && (
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    Cartas (blueprints)
                  </Typography>
                  <Chip
                    size="small"
                    label={`${filteredBlueprints.length} / ${blueprints.length}`}
                    color="default"
                    variant="outlined"
                  />
                </Stack>

                <Paper
                  variant="outlined"
                  sx={{
                    mb: 1.5,
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "grey.50",
                    borderColor: blueprintCatalogFiltersPending ? "primary.light" : "divider",
                  }}
                >
                  <Box sx={{ px: 2, py: 1.25, bgcolor: "background.paper", borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
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
                            Filtros de cartas
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Precio (USD), rareza y orden
                          </Typography>
                        </Box>
                      </Stack>
                      {blueprintCatalogFiltersPending && (
                        <Chip size="small" label="Sin aplicar" color="warning" variant="outlined" />
                      )}
                    </Stack>
                  </Box>

                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      alignItems={{ md: "flex-end" }}
                    >
                      <TextField
                        size="small"
                        label="Precio mín. (USD)"
                        placeholder="0"
                        value={draftBlueprintPriceMinUsd}
                        onChange={(e) => setDraftBlueprintPriceMinUsd(e.target.value)}
                        sx={{ width: { xs: "100%", md: 130 } }}
                        slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      />
                      <TextField
                        size="small"
                        label="Precio máx. (USD)"
                        placeholder="999"
                        value={draftBlueprintPriceMaxUsd}
                        onChange={(e) => setDraftBlueprintPriceMaxUsd(e.target.value)}
                        sx={{ width: { xs: "100%", md: 130 } }}
                        slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      />
                      <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 160 } }}>
                        <InputLabel id="blueprint-sort-label">Orden precio</InputLabel>
                        <Select
                          labelId="blueprint-sort-label"
                          label="Orden precio"
                          value={blueprintPriceSort}
                          onChange={(e) => {
                            setBlueprintPriceSort(e.target.value as BlueprintPriceSort);
                            setBlueprintPage(1);
                          }}
                        >
                          <MenuItem value="asc">Menor → mayor</MenuItem>
                          <MenuItem value="desc">Mayor → menor</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>

                    <Box sx={{ mt: 1.5 }}>
                      <Typography
                        variant="overline"
                        sx={{ letterSpacing: 0.8, fontWeight: 700, color: "text.secondary" }}
                      >
                        Rareza
                      </Typography>
                      <Box sx={{ mt: 0.75 }}>
                        <OfferFilterFacet
                          hint={
                            availableBlueprintRarities.length === 0
                              ? "Sin datos de rareza en esta expansión."
                              : "Sin rarezas seleccionadas = todas."
                          }
                          options={availableBlueprintRarities}
                          selected={draftBlueprintRarities}
                          onToggle={toggleDraftBlueprintRarity}
                          chipSxForValue={(v) => rarityChipSx(v)}
                        />
                      </Box>
                    </Box>
                  </Box>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      px: 2,
                      py: 1.25,
                      bgcolor: "background.paper",
                      borderTop: (t) => `1px solid ${t.palette.divider}`,
                    }}
                  >
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      onClick={clearBlueprintCatalogFilters}
                      disabled={
                        !blueprintCatalogFiltersPending &&
                        draftBlueprintPriceMinUsd === "" &&
                        draftBlueprintPriceMaxUsd === "" &&
                        draftBlueprintRarities.length === 0 &&
                        blueprintPriceSort === "asc"
                      }
                      sx={{ mr: { sm: "auto" } }}
                    >
                      Limpiar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={applyBlueprintCatalogFilters}
                      disabled={!blueprintCatalogFiltersPending}
                      startIcon={<FilterGlyph />}
                      sx={{ fontWeight: 700 }}
                    >
                      Filtrar
                    </Button>
                  </Stack>
                </Paper>

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Página {currentBlueprintPage} de {totalBlueprintPages} · {filteredBlueprints.length}{" "}
                  resultados
                  {expansionMarketQuery.isFetching
                    ? " · cargando precios de mercado…"
                    : blueprintMinPrices.size > 0
                      ? blueprintPriceSort === "desc"
                        ? " · precio mayor primero"
                        : " · precio menor primero"
                      : ""}
                </Typography>
                {expansionMarketQuery.isError && (
                  <Typography variant="caption" color="warning.main" sx={{ display: "block", mb: 1 }}>
                    No se pudieron cargar precios de mercado; orden alfabético.
                  </Typography>
                )}
                <Typography variant="subtitle1" gutterBottom display="none">
                  Cartas (blueprints)
                </Typography>
                {blueprintsQuery.isLoading ? (
                  <CircularProgress size={28} />
                ) : blueprintsQuery.isError ? (
                  <Alert severity="error">Error al cargar blueprints.</Alert>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 1.5,
                      maxHeight: 640,
                      overflowY: "auto",
                      pr: 0.5,
                    }}
                  >
                    {visibleBlueprints.map((bp) => {
                      const selected = blueprint?.id === bp.id;
                      const marketPrice: BlueprintMarketPrice | undefined =
                        blueprintMinPrices.get(bp.id);
                      const priceLabel = marketPrice
                        ? formatBlueprintMarketPrice(marketPrice)
                        : null;
                      const priceCop =
                        marketPrice && copPerUsd !== null
                          ? purchaseCopPerUnit(
                              marketPrice.cents,
                              marketPrice.currency,
                              convert,
                              copPerUsd,
                            )
                          : null;
                      const collector = bp.fixed_properties?.collector_number?.trim();
                      const rarity = blueprintRarityById.get(bp.id);
                      return (
                        <Card
                          key={bp.id}
                          variant="outlined"
                          sx={{
                            cursor: "pointer",
                            borderColor: selected ? "primary.main" : "divider",
                            borderWidth: selected ? 2 : 1,
                            transition: "all 120ms ease",
                            boxShadow: selected ? 3 : 0,
                            "&:hover": {
                              boxShadow: 2,
                              transform: "translateY(-1px)",
                            },
                          }}
                          onClick={() => {
                            setBlueprint(bp);
                            setOffersPage(1);
                            resetOfferFilters();
                          }}
                        >
                          {bp.image_url ? (
                            <CardMedia
                              component="img"
                              height="150"
                              image={bp.image_url}
                              alt=""
                              sx={{ objectFit: "contain", bgcolor: "grey.100" }}
                              onError={(ev) => {
                                (ev.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Box sx={{ height: 150, bgcolor: "grey.200" }} />
                          )}
                          <CardContent sx={{ py: 1.25, px: 1.25 }}>
                            <Typography
                              variant="body2"
                              display="block"
                              noWrap
                              title={bp.name_en ?? bp.name}
                              fontWeight={selected ? 700 : 500}
                            >
                              {bp.name_en ?? bp.name ?? `#${bp.id}`}
                            </Typography>
                            {priceLabel ? (
                              <Box sx={{ mt: 0.25 }}>
                                <Typography
                                  variant="body2"
                                  color="primary.main"
                                  fontWeight={700}
                                  lineHeight={1.3}
                                >
                                  desde {priceLabel}
                                </Typography>
                                {priceCop !== null && (
                                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                    ≈ {formatCOP(Math.round(priceCop))}
                                  </Typography>
                                )}
                              </Box>
                            ) : expansionMarketQuery.isFetching ? (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                                …
                              </Typography>
                            ) : null}
                            {rarity && (
                              <Chip
                                size="small"
                                label={rarity}
                                sx={{
                                  mt: 0.5,
                                  height: 20,
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  maxWidth: "100%",
                                  ...rarityChipSx(rarity),
                                }}
                              />
                            )}
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                              {collector ? `#${collector}` : null}
                              {collector ? " · " : ""}ID {bp.id}
                            </Typography>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}
                {!blueprintsQuery.isLoading && !blueprintsQuery.isError && (
                  <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
                    <Pagination
                      color="primary"
                      shape="rounded"
                      count={totalBlueprintPages}
                      page={currentBlueprintPage}
                      onChange={(_, page) => setBlueprintPage(page)}
                    />
                  </Stack>
                )}
              </Paper>
            )}

            {blueprint && (
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  alignItems={{ md: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 1.5 }}
                  spacing={1}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    Ofertas: {blueprint.name_en ?? blueprint.name ?? blueprint.id}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={viaZero}
                        onChange={(_, c) => setViaZero(c)}
                        size="small"
                      />
                    }
                    label="CardTrader Zero"
                  />
                </Stack>
                <Paper
                  variant="outlined"
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "grey.50",
                    borderColor: offerFiltersPending ? "primary.light" : "divider",
                    boxShadow: offerFiltersPending
                      ? "0 0 0 1px rgba(25, 118, 210, 0.25)"
                      : "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      bgcolor: "background.paper",
                      borderBottom: (t) => `1px solid ${t.palette.divider}`,
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                    >
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
                            Elige varios y pulsa Filtrar
                          </Typography>
                        </Box>
                      </Stack>
                      {offerFiltersPending && (
                        <Chip
                          size="small"
                          label="Cambios sin aplicar"
                          color="warning"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </Stack>
                  </Box>

                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="overline"
                          sx={{ letterSpacing: 0.8, fontWeight: 700, color: "text.secondary" }}
                        >
                          Estado
                        </Typography>
                        <Box sx={{ mt: 0.75 }}>
                          <OfferFilterFacet
                            hint="Sin estados en el listado cargado."
                            options={availableConditions}
                            selected={draftOfferConditions}
                            onToggle={toggleDraftCondition}
                            chipSxForValue={(v) => conditionChipSx(v)}
                          />
                        </Box>
                      </Box>
                      <Divider sx={{ display: { xs: "block", md: "none" } }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="overline"
                          sx={{ letterSpacing: 0.8, fontWeight: 700, color: "text.secondary" }}
                        >
                          Idioma
                        </Typography>
                        <Box sx={{ mt: 0.75 }}>
                          <OfferFilterFacet
                            hint="Sin idiomas en el listado cargado."
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
                        <Typography
                          variant="overline"
                          sx={{ letterSpacing: 0.8, fontWeight: 700, color: "text.secondary" }}
                        >
                          Extras
                        </Typography>
                        <Box sx={{ mt: 0.75 }}>
                          <OfferFilterFacet
                            hint="Sin extras en el listado cargado."
                            options={availableExtras.map((e) => e.id)}
                            selected={draftOfferExtras}
                            onToggle={toggleDraftExtra}
                            renderLabel={(id) => extraFacetLabel(id)}
                            chipSxForValue={(id) => extraChipSx(extraFacetLabel(id))}
                          />
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {(appliedOfferConditions.length > 0 ||
                    appliedOfferLanguages.length > 0 ||
                    appliedOfferExtras.length > 0) && (
                    <Box
                      sx={{
                        px: 2,
                        py: 1,
                        bgcolor: "action.hover",
                        borderTop: (t) => `1px solid ${t.palette.divider}`,
                      }}
                    >
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
                            color="secondary"
                            variant="outlined"
                            onDelete={() => removeAppliedLanguage(lang)}
                            sx={{
                              bgcolor: "background.paper",
                              "& .MuiChip-label": { px: 0.75 },
                            }}
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
                      </Stack>
                    </Box>
                  )}

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="flex-end"
                    alignItems={{ xs: "stretch", sm: "center" }}
                    sx={{
                      px: 2,
                      py: 1.25,
                      bgcolor: "background.paper",
                      borderTop: (t) => `1px solid ${t.palette.divider}`,
                    }}
                  >
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      onClick={clearOfferFilters}
                      disabled={
                        draftOfferConditions.length === 0 &&
                        draftOfferLanguages.length === 0 &&
                        draftOfferExtras.length === 0 &&
                        appliedOfferConditions.length === 0 &&
                        appliedOfferLanguages.length === 0 &&
                        appliedOfferExtras.length === 0
                      }
                      sx={{ order: { xs: 2, sm: 1 }, mr: { sm: "auto" } }}
                    >
                      Limpiar todo
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={applyOfferFilters}
                      disabled={!offerFiltersPending}
                      startIcon={<FilterGlyph />}
                      sx={{
                        order: { xs: 1, sm: 2 },
                        minWidth: { sm: 140 },
                        fontWeight: 700,
                        boxShadow: offerFiltersPending ? 2 : 0,
                      }}
                    >
                      Filtrar
                    </Button>
                  </Stack>
                </Paper>
                {productsQuery.isLoading ? (
                  <CircularProgress size={28} />
                ) : productsQuery.isError ? (
                  <Alert severity="error">Error al cargar productos del marketplace.</Alert>
                ) : products.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No hay listados para este blueprint (o no hay ofertas).
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ sm: "center" }}
                      spacing={1}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Página {currentOffersPage} de {offersTotalPages} · {products.length} ofertas
                      </Typography>
                      <Pagination
                        color="primary"
                        shape="rounded"
                        size="small"
                        count={offersTotalPages}
                        page={currentOffersPage}
                        onChange={(_, page) => setOffersPage(page)}
                      />
                    </Stack>
                    <TableContainer
                      sx={{
                        maxHeight: 520,
                        overflow: "auto",
                        borderRadius: 1.5,
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Table size="small" stickyHeader sx={{ minWidth: 560 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell
                              sx={{
                                bgcolor: "grey.100",
                                fontWeight: 700,
                                py: 1,
                                borderBottom: (t) => `1px solid ${t.palette.divider}`,
                              }}
                            >
                              Vendedor
                            </TableCell>
                            <TableCell
                              sx={{
                                bgcolor: "grey.100",
                                fontWeight: 700,
                                py: 1,
                                borderBottom: (t) => `1px solid ${t.palette.divider}`,
                              }}
                            >
                              Estado · Idioma · Extras · Envío
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                bgcolor: "grey.100",
                                fontWeight: 700,
                                py: 1,
                                borderBottom: (t) => `1px solid ${t.palette.divider}`,
                              }}
                            >
                              Precio
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{
                                bgcolor: "grey.100",
                                fontWeight: 700,
                                py: 1,
                                borderBottom: (t) => `1px solid ${t.palette.divider}`,
                              }}
                            >
                              Stock
                            </TableCell>
                            <TableCell
                              align="right"
                              width={108}
                              sx={{
                                bgcolor: "grey.100",
                                fontWeight: 700,
                                py: 1,
                                borderBottom: (t) => `1px solid ${t.palette.divider}`,
                              }}
                            />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleProducts.map((p) => {
                            const cond = productConditionLabel(p);
                            const chipSx = conditionChipSx(cond);
                            const langRaw = productLangRaw(p);
                            const shipDays =
                              p.user?.username &&
                              shippingQuery.data?.[p.user.username] !== undefined
                                ? `${shippingQuery.data[p.user.username]} d.`
                                : p.on_vacation
                                  ? "Vacaciones"
                                  : "—";
                            const priceText =
                              p.price?.formatted ??
                              moneyFromCents(p.price?.cents, p.price?.currency);
                            const priceCop = purchaseCopPerUnit(
                              p.price?.cents ?? 0,
                              p.price?.currency ?? "USD",
                              convert,
                              copPerUsd,
                            );
                            return (
                              <TableRow key={p.id} hover>
                                <TableCell sx={{ py: 1, verticalAlign: "middle" }}>
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    noWrap
                                    title={p.user?.username}
                                  >
                                    {p.user?.username ?? "?"}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 1, verticalAlign: "middle" }}>
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    useFlexGap
                                  >
                                    <Chip
                                      size="small"
                                      label={cond}
                                      sx={{
                                        height: 22,
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        ...chipSx,
                                      }}
                                    />
                                    {langRaw ? (
                                      <LanguageFlag lang={langRaw} showLabel flagWidth={18} />
                                    ) : (
                                      <Typography variant="caption" fontWeight={600}>
                                        —
                                      </Typography>
                                    )}
                                    {productOfferExtraLabels(p).map((label) => (
                                      <Chip
                                        key={label}
                                        size="small"
                                        label={label}
                                        sx={{
                                          height: 22,
                                          fontSize: "0.7rem",
                                          fontWeight: 600,
                                          ...extraChipSx(label),
                                        }}
                                      />
                                    ))}
                                    <Typography variant="caption" color="text.secondary">
                                      · {shipDays}
                                    </Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell align="right" sx={{ py: 1 }}>
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    justifyContent="flex-end"
                                    alignItems="baseline"
                                    flexWrap="wrap"
                                    useFlexGap
                                  >
                                    <Typography variant="body2" fontWeight={700}>
                                      {priceText}
                                    </Typography>
                                    {priceCop !== null && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        fontWeight={600}
                                      >
                                        ≈ {formatCOP(Math.round(priceCop))}
                                      </Typography>
                                    )}
                                  </Stack>
                                </TableCell>
                                <TableCell align="center" sx={{ py: 1 }}>
                                  {p.quantity ?? 0}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 1 }}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={addMutation.isPending || (p.quantity ?? 0) < 1}
                                    onClick={() =>
                                      addMutation.mutate({
                                        product_id: p.id,
                                        quantity: 1,
                                        meta: buildCartMetaFromOffer({
                                          product: p,
                                          blueprint,
                                          expansion,
                                          blueprintImageUrl:
                                            blueprint?.id !== undefined
                                              ? blueprintImageById[blueprint.id]
                                              : undefined,
                                        }),
                                      })
                                    }
                                  >
                                    Añadir
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                )}
              </Paper>
            )}
          </Stack>
        </Box>

        <Paper
          sx={{
            width: { xs: "100%", lg: 360 },
            flexShrink: 0,
            position: "sticky",
            top: 16,
            borderRadius: 2,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            display: "flex",
            flexDirection: "column",
            maxHeight: { lg: "calc(100vh - 32px)" },
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 2, pb: 1.5, flexShrink: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={700}>
                Carrito CardTrader
              </Typography>
              <Chip size="small" variant="outlined" label={`${lines.length} items`} />
            </Stack>
            {blueprint && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Cotizando: {blueprint.name_en ?? blueprint.name ?? blueprint.id}
              </Typography>
            )}
            {lines.length > 0 && (
              <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  disabled={exportingCartPdf || cartCopTotals.pvpApproxCop === null}
                  onClick={() => void handleExportCartClientePdf()}
                >
                  {exportingCartPdf ? "Generando PDF…" : "Exportar PDF (PVP propuesto)"}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  fullWidth
                  disabled={
                    exportingCartPvpPropioPdf || !hasAnyPvpPropio || cartCopTotals.pvpApproxCop === null
                  }
                  onClick={() => void handleExportCartPvpPropioPdf()}
                >
                  {exportingCartPvpPropioPdf
                    ? "Generando PDF…"
                    : "Exportar PDF (PVP propio)"}
                </Button>
              </Stack>
            )}
          </Box>

          {(isPrompting || rates.usdToCop === null) && lines.length > 0 && (
            <Box sx={{ px: 2, pb: 1 }}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                <Typography variant="caption" display="block" sx={{ mb: 0.75 }}>
                  Tasas de cambio de hoy (las mismas que usa el resto del panel):
                </Typography>
                <Stack spacing={0.75}>
                  <TextField
                    size="small"
                    label="EUR → COP"
                    value={rateInputs.euroToCop}
                    onChange={(e) =>
                      setRateInputs((p) => ({ ...p, euroToCop: e.target.value }))
                    }
                    inputProps={{ inputMode: "decimal" }}
                  />
                  <TextField
                    size="small"
                    label="USD → COP"
                    value={rateInputs.usdToCop}
                    onChange={(e) =>
                      setRateInputs((p) => ({ ...p, usdToCop: e.target.value }))
                    }
                    inputProps={{ inputMode: "decimal" }}
                  />
                  <TextField
                    size="small"
                    label="USD → EUR"
                    value={rateInputs.usdToEur}
                    onChange={(e) =>
                      setRateInputs((p) => ({ ...p, usdToEur: e.target.value }))
                    }
                    inputProps={{ inputMode: "decimal" }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleSaveRates(rateInputs)}
                  >
                    Guardar tasas
                  </Button>
                </Stack>
              </Alert>
            </Box>
          )}

          {copPerUsd !== null && lines.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 0.5, display: "block" }}>
              Tasa USD→COP: {copPerUsd.toLocaleString("es-CO")} · envío{" "}
              {CARDTRADER_SHIPPING_COP_PER_UNIT} COP/carta · IVA 19%
            </Typography>
          )}

          <Box sx={{ flex: 1, overflow: "auto", px: 2, pb: 1 }}>
            {cartQuery.isLoading ? (
              <CircularProgress size={28} />
            ) : cartQuery.isError ? (
              <Alert severity="error">No se pudo leer el carrito.</Alert>
            ) : lines.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Vacío. Añade líneas desde las ofertas.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {lines.map((ln) => {
                  const unitCost = lineUnitCosts.get(ln.key);
                  const thumbSrc = resolveCartThumbnailSrc({
                    productId: ln.productId,
                    imageDataUrl: ln.meta?.imageDataUrl,
                    imageUrl:
                      ln.meta?.imageUrl ??
                      resolveCartLineImageUrl(
                        ln.productId,
                        ln.meta,
                        productMetaById,
                        blueprintImageById,
                      ),
                    apiBase: API_BASE,
                  });
                  return (
                  <Paper key={ln.key} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      {thumbSrc ? (
                        <Box
                          component="img"
                          src={thumbSrc}
                          alt=""
                          sx={{
                            width: 52,
                            height: 72,
                            objectFit: "contain",
                            flexShrink: 0,
                            borderRadius: 1,
                            bgcolor: "grey.100",
                            border: (t) => `1px solid ${t.palette.divider}`,
                          }}
                          onError={(ev) => {
                            (ev.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 52,
                            height: 72,
                            flexShrink: 0,
                            borderRadius: 1,
                            bgcolor: "grey.200",
                            border: (t) => `1px solid ${t.palette.divider}`,
                          }}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={ln.name} fontWeight={600}>
                      {ln.name}
                    </Typography>
                    {ln.meta?.expansion && (
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {ln.meta.expansion}
                        {ln.meta.collectorNumber ? ` · #${ln.meta.collectorNumber}` : ""}
                      </Typography>
                    )}
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 0.5 }}
                    >
                      {ln.meta?.condition && (
                        <Chip
                          size="small"
                          label={ln.meta.condition}
                          sx={{
                            height: 20,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            ...conditionChipSx(ln.meta.condition),
                          }}
                        />
                      )}
                      {ln.meta?.language && (
                        <LanguageFlag lang={ln.meta.language} showLabel flagWidth={16} />
                      )}
                      <Box sx={{ ml: "auto", textAlign: "right" }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {ln.priceLabel} / u.
                        </Typography>
                        {ln.qty > 1 && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Línea: {ln.lineTotalLabel} · ×{ln.qty}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    {unitCost && (
                      <Box
                        sx={{
                          mt: 1,
                          pt: 1,
                          borderTop: (t) => `1px dashed ${t.palette.divider}`,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                          Valores por unidad{ln.qty > 1 ? ` (×${ln.qty} en carrito)` : ""}
                        </Typography>
                        <CopPriceRow label="Precio retail COP / u." value={unitCost.purchaseCop} />
                        <CopPriceRow
                          label="Precio con solo envío / u."
                          value={unitCost.subtotalBeforeIva}
                          emphasized="primary"
                        />
                        <CopPriceRow
                          label="IVA + envío aprox. / u."
                          value={unitCost.ivaPlusShippingCop}
                        />
                        <CopPriceRow
                          label="Costo real (aprox.) / u."
                          value={unitCost.realCostCop}
                        />
                        <CopPriceRow
                          label="PVP aprox. (+30%) / u."
                          value={unitCost.pvpApproxCop}
                          emphasized="default"
                        />
                        <TextField
                          size="small"
                          fullWidth
                          label="PVP propio (COP, opcional)"
                          placeholder={
                            unitCost.pvpApproxCop > 0
                              ? `Ej. ${Math.round(unitCost.pvpApproxCop).toLocaleString("es-CO")}`
                              : undefined
                          }
                          value={
                            pvpPropioDraftById[ln.productId] ??
                            (ln.meta?.pvpPropioCop != null
                              ? String(ln.meta.pvpPropioCop)
                              : "")
                          }
                          onChange={(e) =>
                            setPvpPropioDraftById((prev) => ({
                              ...prev,
                              [ln.productId]: e.target.value,
                            }))
                          }
                          onBlur={(e) => commitPvpPropio(ln.productId, e.target.value)}
                          inputProps={{ inputMode: "decimal" }}
                          sx={{ mt: 0.75 }}
                        />
                      </Box>
                    )}
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mt: 1 }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          sx={{ minWidth: 36, px: 0.5 }}
                          disabled={removeMutation.isPending}
                          onClick={() =>
                            adjustCartQuantity(ln.productId, ln.qty, ln.qty - 1).catch(() => {})
                          }
                        >
                          −
                        </Button>
                        <TextField
                          size="small"
                          value={ln.qty}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isFinite(next)) return;
                            adjustCartQuantity(ln.productId, ln.qty, next).catch(() => {});
                          }}
                          inputProps={{
                            inputMode: "numeric",
                            pattern: "[0-9]*",
                            style: { textAlign: "center", width: 40, padding: 6 },
                          }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          sx={{ minWidth: 36, px: 0.5 }}
                          disabled={addMutation.isPending}
                          onClick={() =>
                            adjustCartQuantity(ln.productId, ln.qty, ln.qty + 1).catch(() => {})
                          }
                        >
                          +
                        </Button>
                      </Stack>
                    </Stack>
                      </Box>
                    </Stack>
                  </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>

          {lines.length > 0 && cartQuery.data?.subtotal && cartQuery.data?.total && (
            <Box
              sx={{
                flexShrink: 0,
                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                bgcolor: "grey.50",
              }}
            >
              <Box sx={{ px: 2, py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="caption">{moneyFromCents(subtotalCents, currency)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Fees CardTrader
                  </Typography>
                  <Typography variant="caption">{moneyFromCents(feeCents, currency)}</Typography>
                </Stack>
                {feesCop !== null && (
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      Fees CardTrader (COP)
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {formatCOP(Math.round(feesCop))}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Envío CardTrader
                  </Typography>
                  <Typography variant="caption">
                    {moneyFromCents(shippingCents, currency)}
                  </Typography>
                </Stack>
                {ctShippingCop !== null && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      Envío CardTrader (COP)
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {formatCOP(Math.round(ctShippingCop))}
                    </Typography>
                  </Stack>
                )}
                {cartCopTotals.realCostCop !== null && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
                    <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.25 }}>
                      Estimación COP (todas las unidades)
                    </Typography>
                    <CopPriceRow
                      label="Precio retail (suma unidades)"
                      value={cartCopTotals.purchaseCop ?? 0}
                    />
                    <CopPriceRow
                      label="Precio con solo envío (suma unidades)"
                      value={cartCopTotals.purchasePlusShippingCop ?? 0}
                      emphasized="primary"
                    />
                    <CopPriceRow
                      label="IVA + envío aprox. (suma unidades)"
                      value={cartCopTotals.ivaPlusShippingCop ?? 0}
                    />
                    <CopPriceRow
                      label="Costo real (aprox., suma unidades)"
                      value={cartCopTotals.realCostCop}
                    />
                    <CopPriceRow
                      label="PVP aprox. (+30%, suma unidades)"
                      value={cartCopTotals.pvpApproxCop ?? 0}
                      emphasized="default"
                    />
                    {cartPvpPropioTotal !== null && (
                      <CopPriceRow
                        label="PVP propio (suma unidades con precio especial)"
                        value={cartPvpPropioTotal}
                        emphasized="primary"
                      />
                    )}
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9, display: "block" }}>
                  Total CardTrader (referencia)
                </Typography>
                <Typography variant="subtitle1" fontWeight={800}>
                  {moneyFromCents(grandTotalCents, currency)}
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      </Stack>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Alert onClose={() => setSnack(null)} severity={snack.severity} sx={{ width: "100%" }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
