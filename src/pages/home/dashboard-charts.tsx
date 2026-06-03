import { Box, Stack, Typography, useTheme } from "@mui/material";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOverviewResponse } from "./dashboard-types";
import {
  MONEY_FLOW_COLORS,
  formatChartMonth,
  formatCOP,
  formatCOPShort,
  stateColor,
  stateLabel,
} from "./dashboard-utils";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  minHeight?: number;
};

function ChartCard({ title, subtitle, children, minHeight = 280 }: ChartCardProps) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        p: 2.5,
        height: "100%",
        minHeight,
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

function CopTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Box
      sx={{
        bgcolor: "rgba(15,23,42,0.92)",
        color: "#fff",
        px: 1.5,
        py: 1,
        borderRadius: 1,
        fontSize: 12,
      }}
    >
      {label ? (
        <Typography variant="caption" display="block" sx={{ opacity: 0.8, mb: 0.5 }}>
          {label}
        </Typography>
      ) : null}
      {payload.map((entry) => (
        <Typography key={entry.name} variant="caption" display="block" fontWeight={600}>
          {entry.name}: {formatCOP(entry.value ?? 0)}
        </Typography>
      ))}
    </Box>
  );
}

type DashboardChartsProps = {
  data: DashboardOverviewResponse;
};

export default function DashboardCharts({ data }: DashboardChartsProps) {
  const theme = useTheme();
  const charts = data.charts;
  const salesRows = charts.sales_by_month ?? [];

  const salesData = salesRows.map((row) => ({
    ...row,
    label: formatChartMonth(row.month),
  }));

  const stockPie = (charts.stock_by_state ?? []).map((row) => ({
    name: stateLabel(row.state),
    value: row.count,
    state: row.state,
  }));

  const moneyData = (charts.money_flow ?? []).map((row) => ({
    ...row,
    fill: MONEY_FLOW_COLORS[row.key] ?? theme.palette.primary.main,
  }));

  const totalSalesPeriod = salesData.reduce((acc, d) => acc + d.amount_cop, 0);
  const totalUnitsPeriod = salesData.reduce((acc, d) => acc + d.count, 0);

  return (
    <Stack spacing={2.5}>
      <ChartCard
        title="Ventas — últimos 6 meses"
        subtitle={`${totalUnitsPeriod} venta(s) · ${formatCOP(totalSalesPeriod)} en el periodo`}
        minHeight={320}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={salesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCOPShort}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as {
                  month?: string;
                  count?: number;
                  amount_cop?: number;
                };
                return (
                  <Box
                    sx={{
                      bgcolor: "rgba(15,23,42,0.92)",
                      color: "#fff",
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      fontSize: 12,
                    }}
                  >
                    <Typography variant="caption" display="block" sx={{ opacity: 0.85 }}>
                      {row?.month ? formatChartMonth(row.month) : label} · {row?.count ?? 0} venta(s)
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {formatCOP(row?.amount_cop ?? 0)}
                    </Typography>
                  </Box>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="amount_cop"
              name="Monto"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#salesGradient)"
              dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2.5,
        }}
      >
        <ChartCard title="Distribución del stock" subtitle="Por estado de línea">
          {stockPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stockPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {stockPie.map((entry) => (
                    <Cell key={entry.state} fill={stateColor(entry.state)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} líneas`, name]}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
              Sin líneas de stock registradas
            </Typography>
          )}
        </ChartCard>

        <ChartCard title="Flujo de dinero" subtitle="Costos vs ingresos pendientes">
          {moneyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={moneyData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                <XAxis
                  type="number"
                  tickFormatter={formatCOPShort}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CopTooltip />} />
                <Bar dataKey="value_cop" name="Monto" radius={[0, 6, 6, 0]} barSize={22}>
                  {moneyData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
              Sin movimientos registrados
            </Typography>
          )}
        </ChartCard>
      </Box>
    </Stack>
  );
}
