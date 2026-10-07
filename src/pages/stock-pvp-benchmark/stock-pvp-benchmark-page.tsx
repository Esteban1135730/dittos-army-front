import {
  Alert,
  Box,
  Chip,
  LinearProgress,
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
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PvpInlineCell } from "../stock/grid-stock/pvp-inline-cell";
import { benchmarkRowToStockItem } from "./benchmark-row-to-stock-item";
import { CardThumb } from "../../components/card-thumb";
import { operationalRarezaLabel } from "../../constants/item-rareza";
import { OWNERS_CONFIG, otherOwner } from "../../config/owners";
import { useOwner } from "../../modules/owner";
import { formatCOP } from "../../utils/convert";
import { HINT_CHIP_COLOR, HINT_LABELS } from "./hint-labels";
import type { StockPvpBenchmarkHint, StockPvpBenchmarkRow } from "./stock-pvp-benchmark.types";
import { useStockPvpBenchmark } from "./use-stock-pvp-benchmark";

function defaultSalesRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 2);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function ownerLabel(key: string | null): string {
  if (!key) return "—";
  const def = OWNERS_CONFIG.owners[key as keyof typeof OWNERS_CONFIG.owners];
  return def?.label ?? key;
}

function filterRows(
  rows: StockPvpBenchmarkRow[],
  q: string,
  hint: StockPvpBenchmarkHint | "all",
): StockPvpBenchmarkRow[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (hint !== "all" && r.hint !== hint) return false;
    if (!needle) return true;
    return (
      r.card_name.toLowerCase().includes(needle) ||
      r.card_id.toLowerCase().includes(needle)
    );
  });
}

export default function StockPvpBenchmarkPage() {
  const { owner } = useOwner();
  const initialRange = useMemo(() => defaultSalesRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [applied, setApplied] = useState(initialRange);
  const [q, setQ] = useState("");
  const [hintFilter, setHintFilter] = useState<StockPvpBenchmarkHint | "all">("all");
  const [pvpSavingKey, setPvpSavingKey] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const queryClient = useQueryClient();
  const toast = useCallback(
    (message: string, severity: "success" | "error") =>
      setSnackbar({ open: true, message, severity }),
    [],
  );

  const { data, isLoading, error, isFetching } = useStockPvpBenchmark(applied);
  const partner = otherOwner(owner);
  const stockLabel = OWNERS_CONFIG.owners[owner].label;

  const rows = useMemo(
    () => filterRows(data?.rows ?? [], q, hintFilter),
    [data?.rows, q, hintFilter],
  );

  const hintCounts = useMemo(() => {
    const counts = new Map<StockPvpBenchmarkHint, number>();
    for (const r of data?.rows ?? []) {
      counts.set(r.hint, (counts.get(r.hint) ?? 0) + 1);
    }
    return counts;
  }, [data?.rows]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Revisión precios PVP
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Inventario vendible de{" "}
            <strong>{stockLabel}</strong>
            {partner
              ? ` comparado con ventas de Pablo y Esteban y PVP de ambos catálogos.`
              : ` comparado con ventas y PVP del mismo dueño.`}{" "}
            Edita el PVP en la columna del dueño activo (igual que en Stock): escribe el
            valor en COP y sal del campo para guardar.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "flex-end" }}
          flexWrap="wrap"
        >
          <TextField
            label="Ventas desde"
            type="date"
            size="small"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Ventas hasta"
            type="date"
            size="small"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Buscar carta"
            size="small"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={isFetching}
            onClick={() => setApplied({ from, to })}
          >
            Actualizar
          </button>
        </Stack>

        {partner ? (
          <Alert severity="info" variant="outlined">
            Perfil activo: <strong>{stockLabel}</strong>. Las columnas Pablo / Esteban muestran el
            PVP catalogado de cada uno para la misma variante (carta + idioma + rareza).
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error">No se pudo cargar la comparación.</Alert>
        ) : null}

        {(isLoading || isFetching) && <LinearProgress />}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`Todas (${data?.rows.length ?? 0})`}
            size="small"
            color={hintFilter === "all" ? "primary" : "default"}
            onClick={() => setHintFilter("all")}
            variant={hintFilter === "all" ? "filled" : "outlined"}
          />
          {(Object.keys(HINT_LABELS) as StockPvpBenchmarkHint[]).map((h) => {
            const n = hintCounts.get(h) ?? 0;
            if (n === 0) return null;
            return (
              <Chip
                key={h}
                label={`${HINT_LABELS[h]} (${n})`}
                size="small"
                color={hintFilter === h ? HINT_CHIP_COLOR[h] : "default"}
                onClick={() => setHintFilter(h)}
                variant={hintFilter === h ? "filled" : "outlined"}
              />
            );
          })}
        </Stack>

        <TableContainer
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Carta</TableCell>
                <TableCell align="right">Uds</TableCell>
                <TableCell align="right">Costo prom.</TableCell>
                <TableCell align="right" sx={{ minWidth: 140 }}>
                  PVP {stockLabel}
                </TableCell>
                {partner ? (
                  <>
                    <TableCell align="right">PVP Pablo</TableCell>
                    <TableCell align="right">PVP Esteban</TableCell>
                  </>
                ) : null}
                <TableCell align="right">Venta mín</TableCell>
                <TableCell align="right">Venta máx</TableCell>
                <TableCell align="right"># ventas</TableCell>
                <TableCell>Señal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={partner ? 11 : 9}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      Sin filas para mostrar.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((row) => (
                <TableRow key={row.variant_key} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <CardThumb src={row.image_url} alt={row.card_name} size="sm" />
                      <Box>
                        <Link
                          to={`/add-pvp/${row.card_id}`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {row.card_name}
                        </Link>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {row.card_id} · {row.language.toUpperCase()}
                          {row.rareza ? ` · ${operationalRarezaLabel(row.rareza)}` : ""}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{row.qty_stock}</TableCell>
                  <TableCell align="right">
                    {row.card_cost_avg != null ? formatCOP(row.card_cost_avg) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        "& .MuiTextField-root": { m: 0 },
                      }}
                    >
                      <PvpInlineCell
                        row={benchmarkRowToStockItem(row)}
                        busy={pvpSavingKey === row.variant_key}
                        onBusyChange={(saving) =>
                          setPvpSavingKey(saving ? row.variant_key : null)
                        }
                        onOutcome={toast}
                        onSaved={async () => {
                          await queryClient.invalidateQueries({
                            queryKey: ["stock-pvp-benchmark"],
                          });
                          await queryClient.invalidateQueries({ queryKey: ["stock"] });
                        }}
                      />
                    </Box>
                  </TableCell>
                  {partner ? (
                    <>
                      <TableCell align="right">
                        {row.pvp_pablo != null ? formatCOP(row.pvp_pablo) : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {row.pvp_esteban != null ? formatCOP(row.pvp_esteban) : "—"}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell align="right">
                    {row.sale_min_cop != null ? (
                      <>
                        {formatCOP(row.sale_min_cop)}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {ownerLabel(row.sale_min_owner)}
                        </Typography>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {row.sale_max_cop != null ? (
                      <>
                        {formatCOP(row.sale_max_cop)}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {ownerLabel(row.sale_max_owner)}
                        </Typography>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell align="right">{row.sales_count}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={HINT_LABELS[row.hint]}
                      color={HINT_CHIP_COLOR[row.hint]}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {data?.meta ? (
          <Typography variant="caption" color="text.secondary">
            {data.meta.row_count} variantes · ventas{" "}
            {data.meta.sales_from ?? "—"} → {data.meta.sales_to ?? "—"} · generado{" "}
            {new Date(data.meta.generated_at).toLocaleString("es-CO")}
          </Typography>
        ) : null}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Stack>
    </Box>
  );
}
