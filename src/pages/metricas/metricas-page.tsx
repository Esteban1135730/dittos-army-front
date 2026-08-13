import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveStockImageUrl } from "../../constants/bulk-product";
import { formatCOP } from "../../utils/convert";
import { useOwner } from "../../modules/owner";
import { fetchMetricsAnalytics } from "./api";
import {
  cycleLabel,
  defaultMetricsPeriod,
  productKindLabel,
} from "./period";
import type { MetricsAnalyticsResponse } from "./types";

const PAGE_BG = "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 48%, #eef2ff 100%)";

function Panel({
  title,
  subtitle,
  children,
  accent,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        p: { xs: 2, md: 2.5 },
        height: "100%",
        boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {accent ? (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: accent,
          }}
        />
      ) : null}
      <Stack spacing={0.35} sx={{ mb: 1.75, pl: accent ? 1 : 0 }}>
        <Typography variant="subtitle1" fontWeight={800} letterSpacing={-0.2}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "error" | "success";
}) {
  const color =
    tone === "error"
      ? "error.main"
      : tone === "success"
        ? "success.main"
        : "text.primary";
  const card = (
    <Box
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: "rgba(255,255,255,0.92)",
        border: "1px solid",
        borderColor: "divider",
        height: "100%",
        cursor: hint ? "help" : "default",
        transition: "box-shadow .15s ease, transform .15s ease",
        "&:hover": hint
          ? { boxShadow: "0 6px 18px rgba(15,23,42,0.08)", transform: "translateY(-1px)" }
          : undefined,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 0.5, fontWeight: 600, letterSpacing: 0.2 }}
      >
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} color={color} sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  );
  return hint ? (
    <Tooltip title={hint} arrow placement="top">
      {card}
    </Tooltip>
  ) : (
    card
  );
}

function moneyTone(n: number | null | undefined): "default" | "error" | "success" {
  if (n == null) return "default";
  if (n < 0) return "error";
  if (n > 0) return "success";
  return "default";
}

/** Costo en rojo; ganancia/margen en verde si >0, rojo si <0. */
function MoneyText({
  value,
  kind,
  empty = "—",
}: {
  value: number | null | undefined;
  kind: "cost" | "profit" | "revenue";
  empty?: string;
}) {
  if (value == null || Number.isNaN(value)) {
    return (
      <Typography component="span" variant="inherit" color="text.secondary">
        {empty}
      </Typography>
    );
  }
  const color =
    kind === "cost"
      ? "error.main"
      : kind === "revenue"
        ? "success.dark"
        : value < 0
          ? "error.main"
          : value > 0
            ? "success.main"
            : "text.primary";
  return (
    <Typography component="span" variant="inherit" fontWeight={700} color={color}>
      {formatCOP(value)}
    </Typography>
  );
}

function cardLabel(name: string | null, id: string): string {
  return name?.trim() ? name : id;
}

function CardThumb({
  cardId,
  imageUrl,
  size = "md",
}: {
  cardId: string;
  imageUrl?: string | null;
  size?: "sm" | "md";
}) {
  const src = resolveStockImageUrl(cardId, imageUrl);
  const w = size === "sm" ? 36 : 44;
  const h = size === "sm" ? 50 : 62;
  if (!src) {
    return (
      <Box
        sx={{
          width: w,
          height: h,
          borderRadius: 1.5,
          bgcolor: "grey.100",
          flexShrink: 0,
          border: "1px solid",
          borderColor: "divider",
        }}
      />
    );
  }
  return (
    <Box
      component="img"
      src={src}
      alt=""
      sx={{
        width: w,
        height: h,
        objectFit: "cover",
        borderRadius: 1.5,
        flexShrink: 0,
        bgcolor: "grey.100",
        border: "1px solid",
        borderColor: "divider",
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

function RankingTable({
  rows,
  showProfit,
  showImage,
}: {
  rows: Array<{
    card_id: string;
    card_name: string | null;
    image_url?: string | null;
    units: number;
    revenue_cop: number;
    cost_cop?: number;
    profit_cop?: number;
  }>;
  showProfit?: boolean;
  showImage?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin ventas en el periodo
      </Typography>
    );
  }
  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, bgcolor: "grey.50" }}>Carta</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "grey.50" }}>
              Uds
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "grey.50" }}>
              Ingreso
            </TableCell>
            {showProfit ? (
              <>
                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "grey.50" }}>
                  Costo
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "grey.50" }}>
                  Ganancia
                </TableCell>
              </>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow
              key={r.card_id}
              sx={{ bgcolor: idx % 2 ? "rgba(248,250,252,0.8)" : "transparent" }}
            >
              <TableCell>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  {showImage ? (
                    <CardThumb cardId={r.card_id} imageUrl={r.image_url} size="sm" />
                  ) : null}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650} noWrap>
                      {cardLabel(r.card_name, r.card_id)}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell align="right">{r.units}</TableCell>
              <TableCell align="right">
                <MoneyText value={r.revenue_cop} kind="revenue" />
              </TableCell>
              {showProfit ? (
                <>
                  <TableCell align="right">
                    <MoneyText value={r.cost_cop ?? 0} kind="cost" />
                  </TableCell>
                  <TableCell align="right">
                    <MoneyText value={r.profit_cop ?? 0} kind="profit" />
                  </TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function LoadingState() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
          <Skeleton variant="rounded" height={88} sx={{ borderRadius: 2.5 }} />
        </Grid>
      ))}
      <Grid size={{ xs: 12, md: 6 }}>
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      </Grid>
    </Grid>
  );
}

export default function MetricasPage() {
  const { owner } = useOwner();
  const defaults = useMemo(() => defaultMetricsPeriod(), []);
  const [fromInput, setFromInput] = useState(defaults.from);
  const [toInput, setToInput] = useState(defaults.to);
  const [applied, setApplied] = useState(defaults);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["metrics", "analytics", applied.from, applied.to, owner],
    queryFn: () => fetchMetricsAnalytics(applied),
  });

  const applyFilters = () => {
    if (!fromInput || !toInput) {
      setRangeError("Indica ambas fechas.");
      return;
    }
    if (fromInput > toInput) {
      setRangeError("Desde no puede ser posterior a Hasta.");
      return;
    }
    setRangeError(null);
    setApplied({ from: fromInput, to: toInput });
  };

  const resetThreeMonths = () => {
    const next = defaultMetricsPeriod();
    setFromInput(next.from);
    setToInput(next.to);
    setRangeError(null);
    setApplied(next);
  };

  const apiErrorMsg = (() => {
    if (!isError) return null;
    if (isAxiosError(error)) {
      const msg = (error.response?.data as { message?: string } | undefined)
        ?.message;
      if (error.response?.status === 400) {
        return msg || "Rango de fechas inválido.";
      }
      return msg || "No se pudieron cargar las métricas.";
    }
    return "No se pudieron cargar las métricas.";
  })();

  return (
    <Box
      sx={{
        minHeight: "100%",
        background: PAGE_BG,
        mx: { xs: -2, md: -3 },
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto" }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ md: "flex-end" }}
          spacing={2}
          sx={{ mb: 2.5 }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={900} letterSpacing={-0.6}>
              Métricas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
              Resumen de ventas e inventario del periodo. Las fechas van por día
              UTC. Distinto del dashboard operativo de ciclo activo en Ventas.
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.25}
            alignItems={{ sm: "flex-end" }}
            sx={{
              bgcolor: "rgba(255,255,255,0.85)",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 1.5,
            }}
          >
            <TextField
              label="Desde"
              type="date"
              size="small"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Hasta"
              type="date"
              size="small"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={applyFilters} sx={{ borderRadius: 2 }}>
              Aplicar
            </Button>
            <Button variant="text" onClick={resetThreeMonths}>
              Últimos 3 meses
            </Button>
          </Stack>
        </Stack>

        {rangeError ? (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            {rangeError}
          </Alert>
        ) : null}

        {isFetching && data ? <LinearProgress sx={{ mb: 2, borderRadius: 1 }} /> : null}
        {isLoading && !data ? <LoadingState /> : null}

        {apiErrorMsg ? (
          <Alert
            severity="error"
            sx={{ mb: 2, borderRadius: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Reintentar
              </Button>
            }
          >
            {apiErrorMsg}
          </Alert>
        ) : null}

        {data && !apiErrorMsg ? <MetricsBody data={data} /> : null}
      </Box>
    </Box>
  );
}

function MetricsBody({ data }: { data: MetricsAnalyticsResponse }) {
  const s = data.summary;
  const emptySales = s.units_sold === 0;
  const tagChart = (data.sales_by_tag ?? []).filter(
    (t) => t.tag !== "sin_etiqueta" || t.units > 0,
  );

  return (
    <Stack spacing={2.5}>
      {s.cost_data_quality.with_fallback > 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Parte de la ganancia usa costo estimado (
          {s.cost_data_quality.with_fallback} sin costo guardado al vender ·{" "}
          {s.cost_data_quality.with_snapshot} con snapshot).
        </Alert>
      ) : null}

      {s.timing_data_quality &&
      (s.timing_data_quality.reception_from_objectid > 0 ||
        s.timing_data_quality.reception_missing > 0 ||
        s.timing_data_quality.tags_from_card_map > 0) ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Fechas parciales: {s.timing_data_quality.with_sale_created_at} ventas con
          fecha · recepción por stocked_at{" "}
          {s.timing_data_quality.reception_from_stocked_at} / id Mongo{" "}
          {s.timing_data_quality.reception_from_objectid} / snapshot{" "}
          {s.timing_data_quality.reception_from_snapshot}. Tags:{" "}
          {s.timing_data_quality.tags_from_snapshot} en venta,{" "}
          {s.timing_data_quality.tags_from_card_map} desde etiquetas actuales.
        </Alert>
      ) : null}

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Unidades vendidas" value={String(s.units_sold)} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Ingreso total"
            value={formatCOP(s.revenue_cop)}
            tone="success"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Ganancia bruta"
            value={formatCOP(s.gross_profit_cop)}
            hint="Ingreso menos el costo de las cartas vendidas."
            tone={moneyTone(s.gross_profit_cop)}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Margen bruto %"
            value={s.gross_margin_pct == null ? "—" : `${s.gross_margin_pct}%`}
            hint="Ganancia ÷ ingreso."
            tone={moneyTone(s.gross_margin_pct)}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Costo de lo vendido"
            value={formatCOP(s.cost_cop)}
            tone="error"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Ticket promedio"
            value={s.aov_cop == null ? "—" : formatCOP(s.aov_cop)}
            hint="Precio promedio por línea de venta."
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Líneas de venta"
            value={String(s.tickets_count)}
            hint="Cantidad de ventas registradas."
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Periodo"
            value={`${data.period.from} → ${data.period.to}`}
          />
        </Grid>
      </Grid>

      {emptySales ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Sin ventas en el periodo.
        </Alert>
      ) : null}

      <Typography variant="overline" color="text.secondary" fontWeight={700}>
        Rankings
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Más vendidas" subtitle="Por unidades" accent="#0f766e">
            <RankingTable rows={data.top_sellers_by_units} showImage />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Más vendidas" subtitle="Por ingreso" accent="#2563eb">
            <RankingTable rows={data.top_sellers_by_revenue} showImage />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Mayor ganancia" accent="#15803d">
            <RankingTable rows={data.top_profit} showProfit showImage />
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Menor ganancia / a pérdida" accent="#b91c1c">
            <RankingTable rows={data.top_loss_sales} showProfit showImage />
          </Panel>
        </Grid>
      </Grid>

      <Typography variant="overline" color="text.secondary" fontWeight={700}>
        Etiquetas y ritmo
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Panel
            title="Ventas por etiqueta"
            subtitle="Jugable, vintage, bulk y brillo. Una carta con varias etiquetas cuenta en cada una."
            accent="#7c3aed"
          >
            {!tagChart.length || tagChart.every((t) => t.units === 0) ? (
              <Typography variant="body2" color="text.secondary">
                Sin ventas etiquetadas en el periodo
              </Typography>
            ) : (
              <>
                <Box sx={{ width: "100%", height: 240, mb: 1 }}>
                  <ResponsiveContainer>
                    <BarChart data={tagChart} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          const n =
                            typeof value === "number" ? value : Number(value);
                          if (name === "units") return [n, "Unidades"];
                          return [formatCOP(n), "Ingreso"];
                        }}
                      />
                      <Bar dataKey="units" fill="#0f766e" name="Unidades" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="revenue_cop" fill="#2563eb" name="Ingreso" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Etiqueta</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Uds
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Ingreso
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Ganancia
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Días venta
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data.sales_by_tag ?? []).map((t) => (
                      <TableRow key={t.tag}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={650}>
                              {t.label}
                            </Typography>
                            {t.approximate && t.units > 0 ? (
                              <Chip size="small" label="Parcial" color="warning" />
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{t.units}</TableCell>
                        <TableCell align="right">
                          <MoneyText value={t.revenue_cop} kind="revenue" />
                        </TableCell>
                        <TableCell align="right">
                          <MoneyText value={t.profit_cop} kind="profit" />
                        </TableCell>
                        <TableCell align="right">
                          {t.avg_days_to_sell == null ? "—" : t.avg_days_to_sell}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Panel
            title="Velocidad por tipo"
            subtitle="Días desde ingreso a stock hasta venta (unit / quantity)."
          >
            {data.velocity_by_product_kind.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin datos de velocidad
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {data.velocity_by_product_kind.map((v) => (
                  <Box
                    key={v.product_kind}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: "grey.50",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography fontWeight={700}>
                        {productKindLabel(v.product_kind)}
                      </Typography>
                      {v.approximate ? (
                        <Chip size="small" label="Aprox." color="warning" />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {v.samples} muestras · prom.{" "}
                      {v.avg_days_to_sell ?? "—"} d · mediana{" "}
                      {v.median_days_to_sell ?? "—"} d
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Panel>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Panel title="Ventas por día">
            {data.sales_by_day.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin ventas en el periodo
              </Typography>
            ) : (
              <Box sx={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={data.sales_by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value, name) => {
                        const n =
                          typeof value === "number" ? value : Number(value);
                        if (name === "units") return [n, "Unidades"];
                        return [formatCOP(n), "Ingreso"];
                      }}
                    />
                    <Bar dataKey="revenue_cop" fill="#2563eb" name="Ingreso" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="units" fill="#94a3b8" name="Unidades" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Panel
            title="Por jornada (ciclo)"
            subtitle="Ciclo activo o fecha de cierre de ventas."
          >
            {data.sales_by_cycle.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin ventas en el periodo
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Ciclo</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Uds
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Ingreso
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.sales_by_cycle.map((c) => (
                    <TableRow key={c.cycle_key}>
                      <TableCell>
                        {cycleLabel(c.cycle_key, c.cycle_closed_at)}
                      </TableCell>
                      <TableCell align="right">{c.units}</TableCell>
                      <TableCell align="right">
                        <MoneyText value={c.revenue_cop} kind="revenue" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
      </Grid>

      <Typography variant="overline" color="text.secondary" fontWeight={700}>
        Inventario a revisar
      </Typography>

      <Panel
        title="Pérdidas de inventario"
        subtitle={`${data.inventory_losses.lines_count} líneas · ${formatCOP(data.inventory_losses.cost_cop)}`}
        accent="#b91c1c"
      >
        {data.inventory_losses.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sin pérdidas en el periodo
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Carta</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Costo
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.inventory_losses.items.map((i) => (
                <TableRow key={i.stock_id}>
                  <TableCell>{cardLabel(i.card_name, i.card_id)}</TableCell>
                  <TableCell align="right">
                    <MoneyText value={i.cost_cop} kind="cost" />
                  </TableCell>
                  <TableCell>
                    {i.lost_at
                      ? new Date(i.lost_at).toLocaleDateString("es-CO")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        title="Cartas a replantear"
        subtitle={`${data.dead_stock.cards_count ?? data.dead_stock.items.length} cartas · ${data.dead_stock.lines_count} líneas · ${formatCOP(data.dead_stock.cost_cop)} · ordenadas por más tiempo. Combina tiempo, % vendidas vs estancadas del tipo y precio. Vintage: rotación ~1 año.`}
        accent="#c2410c"
      >
        {data.dead_stock.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No hay cartas con señales claras de replanteo
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {data.dead_stock.items.map((i) => (
              <Box
                key={`${i.card_id}-${i.stock_id}`}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor:
                    i.priority === "alta"
                      ? "rgba(254,242,242,0.7)"
                      : i.priority === "media"
                        ? "rgba(255,251,235,0.7)"
                        : "grey.50",
                }}
              >
                <CardThumb cardId={i.card_id} imageUrl={i.image_url} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={0.75}
                    mb={0.75}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={800} noWrap>
                        {cardLabel(i.card_name, i.card_id)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(i.stock_lines ?? 1) > 1
                          ? `${i.stock_lines} unidades en stock · `
                          : ""}
                        {i.days_in_stock == null
                          ? "Sin días claros"
                          : `${i.days_in_stock} días`}
                        {" · "}
                        vendidas {i.sales_in_period ?? 0}
                        {i.type_remaining_units != null
                          ? ` / estancadas ${i.type_remaining_units}`
                          : ""}
                        {i.type_sell_through_pct != null
                          ? ` (${i.type_sell_through_pct}% vendidas · ${i.type_stuck_pct ?? 0}% estancadas)`
                          : ""}
                        {i.type_median_days_to_sell != null
                          ? ` · mediana tipo: ${i.type_median_days_to_sell} d`
                          : ""}
                        {i.is_vintage ? " · Vintage" : ""}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={
                        i.priority === "alta"
                          ? "Alta"
                          : i.priority === "media"
                            ? "Media"
                            : "Baja"
                      }
                      color={
                        i.priority === "alta"
                          ? "error"
                          : i.priority === "media"
                            ? "warning"
                            : "default"
                      }
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={2}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="body2">
                      <Box component="span" color="text.secondary">
                        Costo{" "}
                      </Box>
                      <MoneyText value={i.cost_cop} kind="cost" />
                    </Typography>
                    <Typography variant="body2">
                      <Box component="span" color="text.secondary">
                        PVP{" "}
                      </Box>
                      <strong>
                        {i.pvp_cop == null ? "—" : formatCOP(i.pvp_cop)}
                      </strong>
                    </Typography>
                    <Typography variant="body2">
                      <Box component="span" color="text.secondary">
                        Margen{" "}
                      </Box>
                      <MoneyText
                        value={i.potential_margin_cop}
                        kind="profit"
                      />
                      {i.potential_margin_pct != null ? (
                        <Typography
                          component="span"
                          variant="body2"
                          fontWeight={700}
                          color={
                            (i.potential_margin_cop ?? 0) < 0
                              ? "error.main"
                              : "success.main"
                          }
                        >
                          {` (${i.potential_margin_pct}%)`}
                        </Typography>
                      ) : null}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {(i.reasons ?? [])
                      .filter((r) => r !== "Vintage (rotación esperada más lenta)")
                      .map((r) => (
                        <Chip key={r} size="small" label={r} variant="outlined" />
                      ))}
                    {i.is_vintage ? (
                      <Chip size="small" label="Vintage (más laxo)" color="info" />
                    ) : null}
                  </Stack>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Panel>

      <Panel
        title="Indicadores de inventario"
        subtitle="Aproximados con el stock actual. Pasa el mouse para la definición."
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiCard
              label="% vendido vs stock"
              value={
                data.kpis.sell_through_pct == null
                  ? "—"
                  : `${data.kpis.sell_through_pct}%`
              }
              hint="Parte del inventario (vendido + aún vendible) que se vendió en el periodo."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiCard
              label="Rotación de inventario"
              value={
                data.kpis.inventory_turnover_approximate == null
                  ? "—"
                  : String(data.kpis.inventory_turnover_approximate)
              }
              hint="Cuántas veces se renueva el inventario con el costo vendido (aprox.)."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <KpiCard
              label="Ganancia por $ en stock"
              value={
                data.kpis.gmroi_approximate == null
                  ? "—"
                  : String(data.kpis.gmroi_approximate)
              }
              hint="Ganancia bruta del periodo ÷ costo del inventario actual."
              tone={moneyTone(data.kpis.gmroi_approximate)}
            />
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Generado {new Date(data.generated_at).toLocaleString("es-CO")}
        </Typography>
      </Panel>
    </Stack>
  );
}
