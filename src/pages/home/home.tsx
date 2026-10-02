import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { lazy, Suspense, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { formatCOP } from "../../utils/convert";
import { apiUrl } from "../../config/api";
import { normalizeDashboardOverview, profitTone, stateLabel } from "./dashboard-utils";

const DashboardCharts = lazy(() => import("./dashboard-charts"));

const QUICK_LINKS = [
  { to: "/stock", label: "Stock" },
  { to: "/ventas", label: "Ventas" },
  { to: "/clientes", label: "Clientes" },
  { to: "/cardtrader-transit", label: "Tránsito CT" },
  { to: "/incoming-v2", label: "Homologación CT" },
  { to: "/ventas/escanear-qr", label: "Venta QR" },
] as const;

type HeroMetricProps = {
  label: string;
  value: string;
  hint?: string;
  accent: string;
};

function HeroMetric({ label, value, hint, accent }: HeroMetricProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 160,
        p: 2,
        borderRadius: 2,
        bgcolor: alpha("#ffffff", 0.12),
        border: "1px solid",
        borderColor: alpha("#ffffff", 0.18),
        backdropFilter: "blur(6px)",
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: accent,
          mb: 1,
        }}
      />
      <Typography variant="caption" sx={{ color: alpha("#fff", 0.75), display: "block" }}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700} sx={{ color: "#fff", lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: alpha("#fff", 0.65) }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

type DetailMetricProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "error" | "default";
};

function DetailMetric({ label, value, sub, tone = "default" }: DetailMetricProps) {
  const color =
    tone === "success" ? "success.main" : tone === "error" ? "error.main" : "text.primary";
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        height: "100%",
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} color={color}>
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

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        {action}
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Box>
  );
}

function LoadingState() {
  return (
    <Stack spacing={2.5}>
      <Skeleton variant="rounded" height={180} />
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" height={96} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={320} />
    </Stack>
  );
}

export default function Home() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-overview", "v2"],
    queryFn: async () => {
      const res = await axios.get(apiUrl("/dashboard/overview"));
      return normalizeDashboardOverview(res.data);
    },
  });

  const marginPct =
    data && data.stock.inventory_cost_cop > 0
      ? Math.round(
          (data.highlights.inventory_margin_potential_cop /
            data.stock.inventory_cost_cop) *
            100,
        )
      : 0;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      {isFetching && data ? (
        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
      ) : null}

      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          background: "linear-gradient(135deg, #1e293b 0%, #334155 45%, #475569 100%)",
          boxShadow: "0 12px 40px rgba(15,23,42,0.18)",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{ color: "#fff", fontSize: { xs: "1.5rem", sm: "2.125rem" } }}
            >
              Panel operativo
            </Typography>
            <Typography variant="body2" sx={{ color: alpha("#fff", 0.7) }}>
              Resumen del negocio · inventario, ventas y pedidos
            </Typography>
          </Box>
          {data?.generated_at ? (
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              Actualizado {new Date(data.generated_at).toLocaleString("es-CO")}
            </Typography>
          ) : null}
        </Stack>

        {data ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap flexWrap="wrap">
            <HeroMetric
              label="Capital comprometido"
              value={formatCOP(data.highlights.capital_engaged_cop)}
              hint="Inventario + en tránsito"
              accent="#38bdf8"
            />
            <HeroMetric
              label="Ingresos pendientes"
              value={formatCOP(data.highlights.pending_revenue_cop)}
              hint="Ventas activas + reservas"
              accent="#4ade80"
            />
            <HeroMetric
              label="Margen potencial inventario"
              value={formatCOP(data.highlights.inventory_margin_potential_cop)}
              hint={marginPct > 0 ? `~${marginPct}% sobre costo` : "Sin PVP cargado"}
              accent="#fbbf24"
            />
            <HeroMetric
              label="Ganancia estimada total"
              value={formatCOP(data.highlights.combined_estimated_profit_cop)}
              hint="Ventas activas + pedidos"
              accent="#a78bfa"
            />
          </Stack>
        ) : null}
      </Box>

      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
          sx={{ mb: 3 }}
        >
          No se pudo cargar el resumen del negocio.
        </Alert>
      ) : null}

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
        {QUICK_LINKS.map((link) => (
          <Chip
            key={link.to}
            component={Link}
            to={link.to}
            clickable
            label={link.label}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        ))}
      </Stack>

      {isLoading && !data ? (
        <LoadingState />
      ) : data ? (
        <Stack spacing={2.5}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DetailMetric
                label="Líneas vendibles"
                value={String(data.stock.sellable_lines)}
                sub={`${data.stock.total_lines} totales en stock`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DetailMetric
                label="Ventas activas"
                value={String(data.sales.active_count)}
                sub={formatCOP(data.sales.active_amount_cop)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DetailMetric
                label="Reservas / clientes"
                value={`${data.clients_reservations.reservas_stock_count} reservas`}
                sub={`${data.clients_reservations.clients_count} clientes`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DetailMetric
                label="En tránsito"
                value={`${data.incoming.units_in_transit} uds.`}
                sub="CardTrader / en camino"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Suspense fallback={<Skeleton variant="rounded" height={320} />}>
                <DashboardCharts data={data} />
              </Suspense>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={2.5}>
                <Panel
                  title="Operación del día"
                  action={
                    <Button component={Link} to="/ventas" size="small">
                      Ver ventas
                    </Button>
                  }
                >
                  <Stack spacing={2}>
                    <DetailMetric
                      label="Ganancia ventas activas"
                      value={formatCOP(data.sales.active_estimated_profit_cop)}
                      tone={profitTone(data.sales.active_estimated_profit_cop)}
                    />
                    <DetailMetric
                      label="Ventas cerradas (30 días)"
                      value={String(data.sales.closed_last_30_days_count)}
                      sub={formatCOP(data.sales.closed_last_30_days_amount_cop)}
                    />
                    <DetailMetric
                      label="Pedidos reservados"
                      value={formatCOP(data.clients_reservations.ventas_esperadas_cop)}
                      sub={`Ganancia est. ${formatCOP(data.clients_reservations.ganancia_estimada_cop)}`}
                      tone={profitTone(data.clients_reservations.ganancia_estimada_cop)}
                    />
                  </Stack>
                </Panel>

                <Panel
                  title="Inventario"
                  action={
                    <Button component={Link} to="/stock" size="small">
                      Ver stock
                    </Button>
                  }
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Costo
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {formatCOP(data.stock.inventory_cost_cop)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Valor PVP est.
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {formatCOP(data.stock.inventory_pvp_cop)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ pt: 1 }}>
                      {Object.entries(data.stock.by_state)
                        .filter(([, count]) => count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([state, count]) => (
                          <Chip
                            key={state}
                            size="small"
                            label={`${stateLabel(state)} ${count}`}
                            variant="outlined"
                          />
                        ))}
                    </Stack>
                  </Stack>
                </Panel>

                <Panel
                  title="Pipeline"
                  action={
                    <Button component={Link} to="/cardtrader-transit" size="small">
                      Ver tránsito CT
                    </Button>
                  }
                >
                  <Stack spacing={1.5}>
                    <DetailMetric
                      label="Costo en tránsito (CT)"
                      value={formatCOP(data.incoming.estimated_cost_cop)}
                      sub={`${data.incoming.units_in_transit} uds. pendientes`}
                    />
                    <DetailMetric
                      label="Reservas en camino"
                      value={String(data.clients_reservations.reservas_incoming_units)}
                      sub={`${data.clients_reservations.reservas_incoming_client_count} cliente(s)`}
                    />
                  </Stack>
                </Panel>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      ) : null}
    </Box>
  );
}
