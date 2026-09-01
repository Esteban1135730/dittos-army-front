import { Box, Button, Stack, Typography } from "@mui/material";
import { entregaUrgencia } from "../clientes/pedido-ui-utils";
import type { CalendarCell, DayCount, PedidoCalendarioItem } from "./types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  monthLabel: string;
  cells: CalendarCell[];
  byFecha: Record<string, DayCount>;
  selectedYmd: string;
  todayYmd: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDay: (ymd: string) => void;
};

function dayHasOverdue(items: PedidoCalendarioItem[] | undefined): boolean {
  if (!items?.length) return false;
  return items.some(
    (item) =>
      item.overdue ||
      entregaUrgencia(item.fecha_tentativa_entrega, item.status) === "overdue",
  );
}

export default function EnviosCalendar({
  monthLabel,
  cells,
  byFecha,
  selectedYmd,
  todayYmd,
  onPrev,
  onNext,
  onToday,
  onSelectDay,
}: Props) {
  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" fontWeight={800} sx={{ textTransform: "capitalize" }}>
          {monthLabel}
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" size="small" onClick={onPrev} sx={{ textTransform: "none" }}>
            Anterior
          </Button>
          <Button variant="outlined" size="small" onClick={onToday} sx={{ textTransform: "none" }}>
            Hoy
          </Button>
          <Button variant="outlined" size="small" onClick={onNext} sx={{ textTransform: "none" }}>
            Siguiente
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 0.75,
        }}
      >
        {WEEKDAYS.map((label) => (
          <Typography
            key={label}
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            {label}
          </Typography>
        ))}
        {cells.map((cell) => {
          const bucket = byFecha[cell.ymd];
          const overdue = dayHasOverdue(bucket?.items);
          const selected = cell.ymd === selectedYmd;
          const isToday = cell.ymd === todayYmd;
          return (
            <Box
              key={cell.ymd}
              component="button"
              type="button"
              onClick={() => onSelectDay(cell.ymd)}
              aria-pressed={selected}
              aria-label={`${cell.ymd}${bucket ? `, ${bucket.count} envíos` : ""}`}
              sx={(theme) => ({
                appearance: "none",
                font: "inherit",
                color: "inherit",
                width: "100%",
                minHeight: { xs: 64, md: 88 },
                p: 0.75,
                borderRadius: 1.5,
                border: 1,
                borderColor: selected
                  ? "primary.main"
                  : isToday
                    ? theme.palette.ditto.semantic.info
                    : "divider",
                bgcolor: isToday
                  ? theme.palette.ditto.semantic.infoBg
                  : selected
                    ? theme.palette.ditto.surface.muted
                    : cell.inMonth
                      ? "background.paper"
                      : theme.palette.ditto.surface.muted,
                cursor: "pointer",
                textAlign: "left",
                opacity: cell.inMonth ? 1 : 0.55,
                "&:hover": { borderColor: "primary.main" },
              })}
            >
              <Typography
                variant="body2"
                fontWeight={isToday ? 800 : 600}
                color={isToday ? "info.main" : "inherit"}
              >
                {cell.day}
              </Typography>
              {bucket && bucket.count > 0 ? (
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color={overdue ? "error.main" : "text.secondary"}
                >
                  {bucket.count}
                </Typography>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
