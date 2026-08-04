import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@mui/material";
import { useBarcodeScanner } from "../../components/barcode-scanner/use-barcode-scanner";
import { useLaserBarcodeInput } from "../../components/barcode-scanner/use-laser-barcode-input";
import { ScannerErrorBoundary } from "../../components/barcode-scanner/scanner-error-boundary";
import { apiUrl } from "../../config/api";
import { ensureBulkProduct } from "../../api/ensure-bulk";
import { resolveStockImageUrl } from "../../constants/bulk-product";
import { parseStockQrPayload } from "../../modules/stock-barcode";
import {
  rejectReasonMessage,
  reservedScanNotice,
  useVentaAsistidaCart,
  lineProfitCop,
  expandCartLinesToSellBatchItems,
  cartUnitCount,
  type ReservedScanNotice,
  type SellBatchResult,
  type StockScanView,
} from "../../modules/venta-asistida-qr";
import { formatCOP } from "../../utils/convert";

type ScanMode = "laser" | "camera";

const sectionPaper = {
  p: { xs: 2, sm: 3 },
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
} as const;

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

function VentaAsistidaQrContent() {
  const queryClient = useQueryClient();
  const cart = useVentaAsistidaCart();
  const [mode, setMode] = useState<ScanMode>("laser");
  const [cameraOn, setCameraOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<ReservedScanNotice | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [selling, setSelling] = useState(false);
  const [sellMessage, setSellMessage] = useState<string | null>(null);
  const [bulkWarn, setBulkWarn] = useState<string | null>(null);

  const canScan = !scanLoading && !selling;
  const laserFocusRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void ensureBulkProduct().then((r) => {
      if (!r.ok) setBulkWarn(r.error ?? "No se pudo asegurar el SKU bulk");
    });
  }, []);

  const handleScan = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      setScanError(null);
      setScanNotice(null);

      const stockId = parseStockQrPayload(trimmed);
      if (!stockId) {
        setScanError(
          "QR no reconocido. Usa etiquetas QR exportadas desde Stock (DA-STOCK:…).",
        );
        setCameraOn(false);
        return;
      }

      setScanLoading(true);
      try {
        // Excluir líneas unitarias ya en carrito (quantity se re-escanea para +1).
        const excludeIds = cart.lines
          .filter((l) => l.product_kind !== "quantity")
          .map((l) => l.stock_id);
        const excludeQuery =
          excludeIds.length > 0
            ? `?exclude=${encodeURIComponent(excludeIds.join(","))}`
            : "";
        const res = await axios.get<StockScanView>(
          apiUrl(`/stock/${stockId}/scan${excludeQuery}`),
        );
        const view = res.data;

        if (!view.sellable) {
          setScanError(rejectReasonMessage(view.reject_reason));
          setCameraOn(false);
          return;
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
        });

        if (addResult === "duplicate") {
          setScanError("Esta carta ya está en el carrito.");
        } else {
          setScanError(null);
          setScanNotice(reservedScanNotice(view));
        }
      } catch (e) {
        const msg = axios.isAxiosError(e)
          ? (e.response?.data?.message as string) || e.message
          : "No se pudo cargar la carta.";
        setScanError(msg);
      } finally {
        setScanLoading(false);
        setCameraOn(mode === "camera");
        if (mode === "laser") {
          window.setTimeout(() => laserFocusRef.current?.(), 80);
        }
      }
    },
    [cart, mode],
  );

  const laser = useLaserBarcodeInput({
    enabled: mode === "laser",
    onScan: (text) => {
      if (!canScan) return;
      void handleScan(text);
    },
  });
  laserFocusRef.current = laser.focus;

  const { videoRef, status, errorMessage, start } = useBarcodeScanner({
    enabled: mode === "camera" && cameraOn && canScan,
    onScan: (text) => void handleScan(text),
  });

  const handleModeChange = (_: unknown, next: ScanMode | null) => {
    if (!next) return;
    setMode(next);
    setScanError(null);
    setCameraOn(next === "camera");
    if (next === "laser") {
      window.setTimeout(() => laser.focus(), 150);
    }
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
      if (mode === "laser") {
        window.setTimeout(() => laser.focus(), 100);
      }
    }
  };

  const scanning = status === "starting" || status === "scanning";

  const profitColor = (value: number) =>
    value > 0 ? "success.main" : value < 0 ? "error.main" : "text.secondary";

  const formatProfit = (value: number) =>
    `${value > 0 ? "+" : ""}COP ${formatCOP(Math.round(value))}`;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", pb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        mb={3}
      >
        <Box>
          <Typography variant="overline" color="primary.main" fontWeight={700}>
            Mostrador
          </Typography>
          <Typography
            variant="h5"
            fontWeight={800}
            lineHeight={1.2}
            sx={{ fontSize: { xs: "1.5rem", sm: "2.125rem" } }}
          >
            Venta asistida QR
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Escanea, revisa el carrito y confirma la venta del lote.
          </Typography>
        </Box>
        <Button component={Link} to="/ventas" variant="outlined" size="small">
          ← Volver a ventas
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(320px, 5fr) minmax(0, 7fr)" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        {/* Escaneo */}
        <Paper sx={sectionPaper}>
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
                El cursor debe estar en el campo; la pistola envía el texto y Enter.
              </Typography>
              <TextField
                inputRef={laser.inputRef}
                fullWidth
                autoFocus
                placeholder="Clic aquí y escanea…"
                onBlur={() => {
                  if (mode === "laser") {
                    window.setTimeout(() => laser.focus(), 50);
                  }
                }}
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
        <Paper sx={{ ...sectionPaper, display: "flex", flexDirection: "column", minHeight: 420 }}>
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
                    <TableCell align="center" width={110}>
                      Cant.
                    </TableCell>
                    <TableCell align="right" width={130}>
                      Precio
                    </TableCell>
                    <TableCell align="right" width={110}>
                      Ganancia
                    </TableCell>
                    <TableCell align="center" width={72} />
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
                            {img ? (
                              <Box
                                component="img"
                                src={img}
                                alt=""
                                sx={{
                                  width: 44,
                                  height: 62,
                                  objectFit: "contain",
                                  bgcolor: "grey.100",
                                  borderRadius: 1,
                                  border: "1px solid",
                                  borderColor: "grey.200",
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
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
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => cart.removeLine(line.stock_id)}
                            sx={{ minWidth: 0, color: "text.secondary" }}
                          >
                            ✕
                          </Button>
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
      </Box>

      <Snackbar
        open={sellMessage != null}
        autoHideDuration={5000}
        onClose={() => setSellMessage(null)}
        message={sellMessage ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
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
