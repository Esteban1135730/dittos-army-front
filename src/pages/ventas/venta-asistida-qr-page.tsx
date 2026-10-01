import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useBarcodeScanner } from "../../components/barcode-scanner/use-barcode-scanner";
import { useLaserBarcodeInput } from "../../components/barcode-scanner/use-laser-barcode-input";
import { ScannerErrorBoundary } from "../../components/barcode-scanner/scanner-error-boundary";
import { apiUrl } from "../../config/api";
import { ensureBulkProduct } from "../../api/ensure-bulk";
import { resolveStockImageUrl } from "../../constants/bulk-product";
import { CardThumb } from "../../components/card-thumb";
import { parseStockQrPayloadMulti } from "../../modules/stock-barcode";
import {
  cartUnitCount,
  duplicateUnitScanMessage,
  expandCartLinesToSellBatchItems,
  groupCounterSearchRows,
  isQrFavorite,
  lineProfitCop,
  loadQrFavorites,
  pickGroupScanStockId,
  reservedScanNotice,
  saveQrFavorites,
  scanRejectMessage,
  toggleQrFavorite,
  useVentaAsistidaCart,
  type CartLine,
  type CounterSearchGroup,
  type CounterSearchRow,
  type QrFavorite,
  type ReservedScanNotice,
  type SellBatchResult,
  type StockScanView,
} from "../../modules/venta-asistida-qr";
import { formatCOP } from "../../utils/convert";
import { OWNERS_CONFIG, type OwnerKey } from "../../config/owners";
import { useOwner } from "../../modules/owner";
import { useOwnerChangeGuard } from "../../modules/owner/owner-change-guard";

type ScanMode = "laser" | "camera";

const sectionPaper = {
  p: { xs: 2, sm: 3 },
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
} as const;

const sideMenuPaper = {
  ...sectionPaper,
  p: { xs: 1.5, md: 2 },
  display: "flex",
  flexDirection: "column",
  gap: 1.25,
  minHeight: 0,
  height: "100%",
  maxHeight: "100%",
  overflow: "hidden",
} as const;

function formatSearchPrice(
  pvp: number | null,
  currency: string | null,
): string | null {
  if (pvp == null || !(pvp > 0)) return null;
  if (!currency || currency === "COP") return formatCOP(pvp);
  return `${currency} ${pvp}`;
}

function FavoriteStar({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <IconButton
      size="small"
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      sx={{ color: active ? "warning.main" : "text.disabled" }}
    >
      {active ? "★" : "☆"}
    </IconButton>
  );
}

function SummaryCard({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        p: 2,
        borderRadius: 2,
        bgcolor: "grey.50",
        border: "1px solid",
        borderColor: "grey.200",
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} color={valueColor ?? "text.primary"} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
}

function SideMenuFrame({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Paper sx={sideMenuPaper}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        {count != null ? <Chip label={count} size="small" /> : null}
      </Stack>
      {children}
    </Paper>
  );
}

function FavoritesMenu({
  favorites,
  canScan,
  onAdd,
  onToggle,
}: {
  favorites: QrFavorite[];
  canScan: boolean;
  onAdd: (fav: QrFavorite) => void;
  onToggle: (fav: QrFavorite) => void;
}) {
  return (
    <SideMenuFrame title="Favoritos" count={favorites.length}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.25 }}>
        {favorites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Marca una carta con la estrella para tenerla en este menú.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {favorites.map((fav) => {
              const img = resolveStockImageUrl(fav.card_id, fav.image_url);
              return (
                <Stack
                  key={`${fav.owner}-${fav.stock_id}-${fav.card_id}-${fav.language}-${fav.rareza ?? ""}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  onClick={() => {
                    if (!canScan) return;
                    onAdd(fav);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !canScan) return;
                    e.preventDefault();
                    onAdd(fav);
                  }}
                  sx={{
                    px: 0.75,
                    py: 0.75,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "grey.200",
                    cursor: canScan ? "pointer" : "default",
                    "&:hover": { bgcolor: "grey.50" },
                  }}
                >
                  <CardThumb src={img} alt={fav.card_name || "carta"} size="sm" />
                  <Box minWidth={0} flex={1}>
                    <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.25 }}>
                      {fav.card_name || "Sin nombre"}
                    </Typography>
                    {fav.language ? (
                      <Chip
                        label={fav.language}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: 10, mt: 0.5 }}
                      />
                    ) : null}
                  </Box>
                  <FavoriteStar active onToggle={() => onToggle(fav)} />
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </SideMenuFrame>
  );
}

function SearchMenu({
  searchInput,
  onSearchInput,
  searchLoading,
  searchError,
  debouncedSearch,
  searchGroups,
  canScan,
  unitExcludeIds,
  activeOwner,
  favorites,
  onAddGroup,
  onToggleFavorite,
}: {
  searchInput: string;
  onSearchInput: (value: string) => void;
  searchLoading: boolean;
  searchError: string | null;
  debouncedSearch: string;
  searchGroups: CounterSearchGroup[];
  canScan: boolean;
  unitExcludeIds: string[];
  activeOwner: OwnerKey;
  favorites: QrFavorite[];
  onAddGroup: (group: CounterSearchGroup) => void;
  onToggleFavorite: (fav: QrFavorite) => void;
}) {
  return (
    <SideMenuFrame title="Buscar">
      <TextField
        fullWidth
        size="small"
        label="Nombre de la carta"
        placeholder="Escribe para buscar"
        value={searchInput}
        autoComplete="off"
        onChange={(e) => onSearchInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || searchGroups.length !== 1 || !canScan) return;
          e.preventDefault();
          onAddGroup(searchGroups[0]);
        }}
        inputProps={{ "aria-label": "Buscar carta por nombre" }}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.25 }}>
        {searchLoading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Buscando…
            </Typography>
          </Stack>
        ) : null}
        {searchError ? (
          <Alert severity="warning" variant="outlined">
            {searchError}
          </Alert>
        ) : null}
        {debouncedSearch && !searchLoading && !searchError && searchGroups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sin resultados vendibles.
          </Typography>
        ) : null}
        <Stack spacing={0.75}>
          {searchGroups.map((group) => {
            const price = formatSearchPrice(group.pvp, group.pvp_currency);
            const img = resolveStockImageUrl(group.card_id, group.image_url);
            const fav = {
              stock_id:
                pickGroupScanStockId(group.stock_ids, unitExcludeIds) ??
                group.stock_ids[0],
              card_id: group.card_id,
              card_name: group.card_name,
              image_url: img,
              language: group.language,
              rareza: group.rareza,
              owner: activeOwner,
            } satisfies QrFavorite;
            return (
              <Stack
                key={group.key}
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() => {
                  if (!canScan) return;
                  onAddGroup(group);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !canScan) return;
                  e.preventDefault();
                  onAddGroup(group);
                }}
                sx={{
                  px: 0.75,
                  py: 0.75,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "grey.200",
                  cursor: canScan ? "pointer" : "default",
                  "&:hover": { bgcolor: "grey.50" },
                }}
              >
                <CardThumb src={img} alt={group.card_name || "carta"} size="sm" />
                <Box minWidth={0} flex={1}>
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.25 }}>
                    {group.card_name || "Sin nombre"}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {group.language ? (
                      <Chip label={group.language} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                    ) : null}
                    {group.rareza ? (
                      <Chip label={group.rareza} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                    ) : null}
                    <Chip
                      label={`${group.count} ${group.count === 1 ? "disponible" : "disponibles"}`}
                      size="small"
                      sx={{ height: 20, fontSize: 10 }}
                    />
                  </Stack>
                  {price ? (
                    <Typography variant="caption" fontWeight={700} display="block" sx={{ mt: 0.25 }}>
                      {price}
                    </Typography>
                  ) : null}
                </Box>
                <FavoriteStar
                  active={isQrFavorite(favorites, fav)}
                  onToggle={() => onToggleFavorite(fav)}
                />
              </Stack>
            );
          })}
        </Stack>
      </Box>
    </SideMenuFrame>
  );
}

function VentaAsistidaQrContent() {
  const queryClient = useQueryClient();
  const { owner: activeOwner } = useOwner();
  const cart = useVentaAsistidaCart();
  const [mode, setMode] = useState<ScanMode>("laser");
  const [cameraOn, setCameraOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<ReservedScanNotice | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [selling, setSelling] = useState(false);
  const [sellMessage, setSellMessage] = useState<string | null>(null);
  const [bulkWarn, setBulkWarn] = useState<string | null>(null);
  const [ownerAmbiguousMsg, setOwnerAmbiguousMsg] = useState<string | null>(null);
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const [sideMenu, setSideMenu] = useState<"favorites" | "search" | null>(null);
  const [favorites, setFavorites] = useState<QrFavorite[]>(() => loadQrFavorites());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchHits, setSearchHits] = useState<CounterSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const focusLaserRef = useRef<() => void>(() => {});
  const inFlightRef = useRef(false);

  const canScan = !scanLoading && !selling;

  const cartClearGuard = useCallback(
    (_next: OwnerKey) => {
      if (cart.lines.length === 0) return true;
      const ok = window.confirm(
        "Hay ítems en el carrito QR. Al cambiar de owner se vaciará el carrito. ¿Continuar?",
      );
      if (ok) cart.clear();
      return ok;
    },
    [cart],
  );
  useOwnerChangeGuard(cartClearGuard);

  useEffect(() => {
    void ensureBulkProduct().then((r) => {
      if (!r.ok) setBulkWarn(r.error ?? "No se pudo asegurar el SKU bulk");
    });
  }, []);

  useEffect(() => {
    saveQrFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchHits([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    const ac = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    void axios
      .get<CounterSearchRow[] | null>(
        apiUrl(`/stock?q=${encodeURIComponent(debouncedSearch)}`),
        { signal: ac.signal },
      )
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setSearchHits(
          rows.map((row) => ({
            ...row,
            _id: String(row._id ?? ""),
            card_id: String(row.card_id ?? ""),
          })),
        );
      })
      .catch((e: unknown) => {
        if (axios.isCancel(e)) return;
        if (axios.isAxiosError(e) && e.code === "ERR_CANCELED") return;
        setSearchHits([]);
        setSearchError("No se pudo buscar en el stock.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setSearchLoading(false);
      });
    return () => ac.abort();
  }, [debouncedSearch]);

  const unitExcludeIds = useMemo(
    () =>
      cart.lines
        .filter((l) => l.product_kind !== "quantity")
        .map((l) => l.stock_id),
    [cart.lines],
  );

  const searchGroups = useMemo(
    () => groupCounterSearchRows(searchHits),
    [searchHits],
  );

  const addByStockId = useCallback(
    async (
      stockId: string,
      scanOwner: OwnerKey | null | undefined,
      source: "scanner" | "manual",
    ) => {
      if (inFlightRef.current || selling) return;
      inFlightRef.current = true;
      setScanError(null);
      setScanNotice(null);
      setOwnerAmbiguousMsg(null);
      setScanLoading(true);
      let added = false;
      try {
        const excludeIds = cart.lines
          .filter((l) => l.product_kind !== "quantity")
          .map((l) => l.stock_id);
        const params = new URLSearchParams();
        params.set("multi", "1");
        if (scanOwner) params.set("scan_owner", scanOwner);
        if (excludeIds.length > 0) {
          params.set("exclude", excludeIds.join(","));
        }
        const res = await axios.get<StockScanView>(
          apiUrl(`/stock/${stockId}/scan?${params.toString()}`),
        );
        const view = res.data;

        if (!view.sellable) {
          setScanError(
            scanRejectMessage(view, { requestedId: stockId, excludeIds }),
          );
          if (source === "scanner") setCameraOn(false);
          return;
        }

        const lineOwner: OwnerKey = view.owner ?? scanOwner ?? activeOwner;

        if (view.owner_ambiguous_resolved) {
          setOwnerAmbiguousMsg(
            `ObjectId presente en ambas bases; se usó ${OWNERS_CONFIG.owners[lineOwner].label}.`,
          );
        }

        const addResult = cart.addLine({
          stock_id: view.stock_id,
          card_id: view.card_id ?? "",
          card_name: view.card_name,
          image_url: resolveStockImageUrl(view.card_id, view.image_url),
          amount_cop: view.price_cop ?? 0,
          card_cost_cop: view.card_cost_cop ?? 0,
          expansion: view.expansion ?? "",
          rareza: view.rareza ?? null,
          language: view.language ?? "",
          product_kind: view.product_kind ?? "unit",
          qty: 1,
          reserved: view.reserved_fallback === true,
          owner: lineOwner,
        });

        if (addResult === "duplicate") {
          setScanError(duplicateUnitScanMessage(view.product_kind));
          if (source === "scanner") setCameraOn(false);
          return;
        }
        setScanError(null);
        setScanNotice(reservedScanNotice(view));
        added = true;
      } catch (e) {
        const msg = axios.isAxiosError(e)
          ? (e.response?.data?.message as string) || e.message
          : "No se pudo cargar la carta.";
        setScanError(msg);
        if (source === "scanner") setCameraOn(false);
      } finally {
        inFlightRef.current = false;
        setScanLoading(false);
        if (source === "scanner") setCameraOn(mode === "camera");
        if (added && mode === "laser") focusLaserRef.current();
      }
    },
    [cart, mode, activeOwner, selling],
  );

  const handleScan = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      const parsed = parseStockQrPayloadMulti(trimmed);
      if (!parsed) {
        setScanError(
          "QR no reconocido. Usa etiquetas DA-STOCK:… o ESTEBAN-STOCK:….",
        );
        setScanNotice(null);
        setCameraOn(false);
        return;
      }
      await addByStockId(parsed.stockId, parsed.owner ?? null, "scanner");
    },
    [addByStockId],
  );

  const toggleFavorite = useCallback((next: QrFavorite) => {
    setFavorites((prev) => toggleQrFavorite(prev, next));
  }, []);

  const favoriteFromLine = useCallback(
    (line: CartLine): QrFavorite => ({
      stock_id: line.stock_id,
      card_id: line.card_id,
      card_name: line.card_name,
      image_url: line.image_url,
      language: line.language,
      rareza: line.rareza,
      owner: line.owner,
    }),
    [],
  );

  const addSearchGroup = useCallback(
    (group: CounterSearchGroup) => {
      const stockId = pickGroupScanStockId(group.stock_ids, unitExcludeIds);
      if (!stockId) return;
      void addByStockId(stockId, activeOwner, "manual");
    },
    [addByStockId, activeOwner, unitExcludeIds],
  );

  const laser = useLaserBarcodeInput({
    enabled: mode === "laser",
    autoFocusOnEnable: false,
    onScan: (text) => {
      if (!canScan) return;
      void handleScan(text);
    },
  });
  focusLaserRef.current = laser.focus;

  const { videoRef, status, errorMessage, start } = useBarcodeScanner({
    enabled: mode === "camera" && cameraOn && canScan,
    onScan: (text) => void handleScan(text),
  });

  const handleModeChange = (_: unknown, next: ScanMode | null) => {
    if (!next) return;
    setMode(next);
    setScanError(null);
    setCameraOn(next === "camera");
  };

  const handleSellAll = async () => {
    if (cart.lines.length === 0) return;
    const invalid = cart.lines.find((l) => l.amount_cop <= 0);
    if (invalid) {
      setScanError("Todos los precios deben ser mayores a 0.");
      return;
    }

    setSelling(true);
    setScanError(null);
    try {
      const res = await axios.post<SellBatchResult>(apiUrl("/sales/sell-batch"), {
        items: expandCartLinesToSellBatchItems(cart.lines),
      });
      const data = res.data;
      const soldIds = data.results.filter((r) => r.success).map((r) => r.stock_id);
      const failed = data.results.filter((r) => !r.success);

      cart.removeSold(soldIds);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });

      if (failed.length === 0) {
        setSellMessage(`Se vendieron ${data.sold_count} unidades.`);
        cart.clear();
      } else {
        setSellMessage(
          `Vendidas: ${data.sold_count}. Fallaron: ${failed.map((f) => f.message ?? f.stock_id).join("; ")}`,
        );
      }
    } catch {
      setScanError("No se pudo completar la venta. Intenta de nuevo.");
    } finally {
      setSelling(false);
    }
  };

  const scanning = status === "starting" || status === "scanning";

  const profitColor = (value: number) =>
    value > 0 ? "success.main" : value < 0 ? "error.main" : "text.secondary";

  const formatProfit = (value: number) =>
    `${value > 0 ? "+" : ""}COP ${formatCOP(Math.round(value))}`;

  const renderFavoritesMenu = () => (
    <FavoritesMenu
      favorites={favorites}
      canScan={canScan}
      onAdd={(fav) => void addByStockId(fav.stock_id, fav.owner, "manual")}
      onToggle={toggleFavorite}
    />
  );

  const renderSearchMenu = () => (
    <SearchMenu
      searchInput={searchInput}
      onSearchInput={setSearchInput}
      searchLoading={searchLoading}
      searchError={searchError}
      debouncedSearch={debouncedSearch}
      searchGroups={searchGroups}
      canScan={canScan}
      unitExcludeIds={unitExcludeIds}
      activeOwner={activeOwner}
      favorites={favorites}
      onAddGroup={addSearchGroup}
      onToggleFavorite={toggleFavorite}
    />
  );

  return (
    <Box
      sx={{
        pb: { xs: 1, md: 0 },
        height: { md: "calc(100dvh - 24px)" },
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: { md: "hidden" },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        mb={1.5}
      >
        <Box>
          <Typography variant="overline" color="primary.main" fontWeight={700}>
            Mostrador
          </Typography>
          <Typography
            variant="h5"
            fontWeight={800}
            lineHeight={1.2}
            sx={{ fontSize: { xs: "1.35rem", sm: "1.75rem" } }}
          >
            Venta asistida QR
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {isWide ? null : (
            <>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSideMenu("favorites")}
              >
                Favoritos ({favorites.length})
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSideMenu("search")}
              >
                Buscar
              </Button>
            </>
          )}
          <Button component={Link} to="/ventas" variant="outlined" size="small">
            ← Volver a ventas
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          flex: { md: 1 },
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(260px, 300px) minmax(0, 1fr) minmax(300px, 360px)",
          },
          gap: 2,
          alignItems: "stretch",
        }}
      >
        {isWide ? renderFavoritesMenu() : null}
        <Stack
          spacing={2}
          sx={{ minWidth: 0, minHeight: 0, height: { md: "100%" } }}
        >
        {/* Escaneo */}
        <Paper sx={{ ...sectionPaper, p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Escanear
          </Typography>

          <ToggleButtonGroup
            exclusive
            fullWidth
            value={mode}
            onChange={handleModeChange}
            size="small"
            color="primary"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="laser">Pistola QR</ToggleButton>
            <ToggleButton value="camera">Cámara</ToggleButton>
          </ToggleButtonGroup>

          {mode === "laser" ? (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Haz clic en el campo para escanear con la pistola. Luego puedes editar precios en el carrito.
              </Typography>
              <TextField
                inputRef={laser.inputRef}
                fullWidth
                placeholder="Clic aquí y escanea…"
                onClick={() => laser.focus()}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    fontSize: "1.05rem",
                    fontFamily: "ui-monospace, monospace",
                    bgcolor: "grey.50",
                    "&.Mui-focused fieldset": {
                      borderWidth: 2,
                      borderColor: "primary.main",
                    },
                  },
                }}
              />
            </Box>
          ) : (
            <Box>
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4/3",
                  bgcolor: "#0f172a",
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "2px solid",
                  borderColor: scanning ? "success.light" : "grey.800",
                }}
              >
                {cameraOn ? (
                  <>
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      autoPlay
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    {scanning && (
                      <Box
                        sx={{
                          position: "absolute",
                          inset: "22% 18%",
                          border: "2px solid",
                          borderColor: "success.light",
                          borderRadius: 1,
                          boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </>
                ) : (
                  <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", p: 2 }}>
                    <Typography variant="body2" color="grey.400" textAlign="center" mb={2}>
                      Activa la cámara para leer códigos QR
                    </Typography>
                    <Button variant="contained" onClick={() => setCameraOn(true)}>
                      Activar cámara
                    </Button>
                  </Stack>
                )}
              </Box>
              {scanning && (
                <Typography variant="caption" color="success.main" sx={{ mt: 1, display: "block" }}>
                  Enfoca el QR dentro del recuadro
                </Typography>
              )}
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() => void start()}
                disabled={scanning || !cameraOn}
              >
                Reiniciar cámara
              </Button>
            </Box>
          )}

          {scanLoading && (
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Buscando carta…
              </Typography>
            </Stack>
          )}

          {mode === "camera" && errorMessage && (
            <Alert severity="error" sx={{ mt: 2 }} variant="outlined">
              {errorMessage}
            </Alert>
          )}

          {scanError && (
            <Alert severity="warning" sx={{ mt: 2 }} variant="outlined">
              {scanError}
            </Alert>
          )}

          {scanNotice && (
            <Alert severity={scanNotice.severity} sx={{ mt: 2 }} variant="outlined">
              {scanNotice.message}
            </Alert>
          )}
        </Paper>

        {/* Carrito */}
        <Paper sx={{ ...sectionPaper, p: { xs: 1.5, sm: 2 }, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Carrito
            </Typography>
            <Chip
              label={`${cartUnitCount(cart.lines)} ${cartUnitCount(cart.lines) === 1 ? "unidad" : "unidades"}`}
              size="small"
              color={cart.lines.length > 0 ? "primary" : "default"}
            />
          </Stack>

          {bulkWarn ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              variant="outlined"
              onClose={() => setBulkWarn(null)}
            >
              {bulkWarn}
            </Alert>
          ) : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
            <SummaryCard
              label="Total venta"
              value={`COP ${formatCOP(cart.totalCop)}`}
            />
            <SummaryCard
              label="Ganancia lote"
              value={formatProfit(cart.totalProfitCop)}
              valueColor={profitColor(cart.totalProfitCop)}
            />
          </Stack>

          {cart.lines.length === 0 ? (
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                py: 6,
                px: 2,
                borderRadius: 2,
                border: "2px dashed",
                borderColor: "grey.300",
                bgcolor: "grey.50",
              }}
            >
              <Typography color="text.secondary" textAlign="center">
                El carrito está vacío.
                <br />
                Escanea una etiqueta QR para comenzar.
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ flex: 1, borderRadius: 1, border: "1px solid", borderColor: "grey.200", overflowX: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "grey.100", fontWeight: 700 } }}>
                    <TableCell>Carta</TableCell>
                    <TableCell align="center" width={90}>
                      Owner
                    </TableCell>
                    <TableCell align="center" width={110}>
                      Cant.
                    </TableCell>
                    <TableCell align="right" width={130}>
                      Precio
                    </TableCell>
                    <TableCell align="right" width={110}>
                      Ganancia
                    </TableCell>
                    <TableCell align="center" width={104} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.lines.map((line) => {
                    const profit = lineProfitCop(line);
                    const qty = line.qty ?? 1;
                    const img = resolveStockImageUrl(line.card_id, line.image_url);
                    return (
                      <TableRow
                        key={line.stock_id}
                        hover
                        sx={{ "&:last-child td": { borderBottom: 0 } }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <CardThumb
                              src={img}
                              alt={line.card_name || "carta"}
                              size="lg"
                              enlargeOnHover
                            />
                            <Box minWidth={0}>
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {line.card_name || "Sin nombre"}
                              </Typography>
                              {line.expansion ? (
                                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                  {line.expansion}
                                </Typography>
                              ) : null}
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                {line.rareza ? (
                                  <Chip label={line.rareza} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                                ) : null}
                                {line.language ? (
                                  <Chip label={line.language} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                                ) : null}
                                {line.reserved ? (
                                  <Chip label="Reservada" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />
                                ) : null}
                              </Stack>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={OWNERS_CONFIG.owners[line.owner]?.label ?? line.owner}
                            size="small"
                            color={line.owner === "esteban" ? "secondary" : "default"}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {line.product_kind === "quantity" ? (
                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                              <IconButton
                                size="small"
                                aria-label="menos"
                                onClick={() =>
                                  cart.updateQty(line.stock_id, Math.max(1, qty - 1))
                                }
                              >
                                −
                              </IconButton>
                              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20 }}>
                                {qty}
                              </Typography>
                              <IconButton
                                size="small"
                                aria-label="más"
                                onClick={() => cart.updateQty(line.stock_id, qty + 1)}
                              >
                                +
                              </IconButton>
                            </Stack>
                          ) : (
                            <Typography variant="body2">1</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={line.amount_cop}
                            onChange={(e) =>
                              cart.updatePrice(line.stock_id, Number(e.target.value) || 0)
                            }
                            inputProps={{ min: 1, step: 100 }}
                            sx={{
                              width: 112,
                              "& input": { textAlign: "right", fontWeight: 600 },
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color={profitColor(profit)}>
                            {formatProfit(profit)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" alignItems="center" justifyContent="center">
                            <FavoriteStar
                              active={isQrFavorite(favorites, line)}
                              onToggle={() => toggleFavorite(favoriteFromLine(line))}
                            />
                            <Button
                              size="small"
                              color="inherit"
                              aria-label="Quitar del carrito"
                              onClick={() => cart.removeLine(line.stock_id)}
                              sx={{ minWidth: 0, color: "text.secondary" }}
                            >
                              ✕
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="flex-end"
          >
            <Button
              variant="outlined"
              color="inherit"
              disabled={cart.lines.length === 0 || selling}
              onClick={() => cart.clear()}
              sx={{ borderColor: "grey.300" }}
            >
              Vaciar carrito
            </Button>
            <Button
              variant="contained"
              color="success"
              size="large"
              fullWidth
              disabled={cart.lines.length === 0 || selling}
              onClick={() => void handleSellAll()}
              sx={{ px: 4, fontWeight: 700, width: { sm: "auto" } }}
            >
              {selling ? "Vendiendo…" : "Vender todo"}
            </Button>
          </Stack>
        </Paper>
        </Stack>
        {isWide ? renderSearchMenu() : null}
      </Box>

      <Drawer
        anchor="left"
        open={!isWide && sideMenu === "favorites"}
        onClose={() => setSideMenu(null)}
      >
        <Box
          sx={{
            width: 320,
            maxWidth: "88vw",
            height: "100%",
            p: 1.5,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!isWide ? renderFavoritesMenu() : null}
        </Box>
      </Drawer>
      <Drawer
        anchor="right"
        open={!isWide && sideMenu === "search"}
        onClose={() => setSideMenu(null)}
      >
        <Box
          sx={{
            width: 340,
            maxWidth: "92vw",
            height: "100%",
            p: 1.5,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!isWide ? renderSearchMenu() : null}
        </Box>
      </Drawer>

      <Snackbar
        open={sellMessage != null}
        autoHideDuration={5000}
        onClose={() => setSellMessage(null)}
        message={sellMessage ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <Snackbar
        open={ownerAmbiguousMsg != null}
        autoHideDuration={6000}
        onClose={() => setOwnerAmbiguousMsg(null)}
        message={ownerAmbiguousMsg ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      />
    </Box>
  );
}

export default function VentaAsistidaQrPage() {
  return (
    <ScannerErrorBoundary>
      <VentaAsistidaQrContent />
    </ScannerErrorBoundary>
  );
}
