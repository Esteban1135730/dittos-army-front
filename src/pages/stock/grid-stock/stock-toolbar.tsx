import type { ReactNode } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  IconDocument,
  IconDownload,
  IconPrint,
  IconQr,
  IconSearch,
} from "../../../components/layout/panel-nav-icons";
import { formatCOP } from "../../../utils/convert";
import { IconTrash } from "./stock-action-icons";

type MoneyTriple = { cop: number; eur: number; usd: number };

type StockToolbarProps = {
  busqueda: string;
  onBusquedaChange: (value: string) => void;
  exportando: boolean;
  exportandoBarcode: boolean;
  imprimiendo: boolean;
  limpiandoPvp: boolean;
  actualizandoTienda: boolean;
  canExportTienda: boolean;
  onExportPdf: () => void;
  onExportQr: () => void;
  onPrintCatalog: () => void;
  onClearAllPvp: () => void;
  onUpdateStore: () => void;
};

function BusyIcon({ busy, children }: { busy: boolean; children: ReactNode }) {
  if (busy) {
    return <CircularProgress size={16} color="inherit" />;
  }
  return children;
}

export function StockToolbar({
  busqueda,
  onBusquedaChange,
  exportando,
  exportandoBarcode,
  imprimiendo,
  limpiandoPvp,
  actualizandoTienda,
  canExportTienda,
  onExportPdf,
  onExportQr,
  onPrintCatalog,
  onClearAllPvp,
  onUpdateStore,
}: StockToolbarProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1}
      alignItems={{ md: "center" }}
      sx={{ mb: 1 }}
    >
      <TextField
        value={busqueda}
        onChange={(e) => onBusquedaChange(e.target.value)}
        placeholder="Buscar carta…"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: 1, minWidth: { md: 220 } }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <ButtonGroup variant="outlined" size="small">
          <Button
            onClick={onExportPdf}
            disabled={exportando}
            startIcon={<BusyIcon busy={exportando}><IconDocument /></BusyIcon>}
          >
            PDF
          </Button>
          <Button
            onClick={() => void onExportQr()}
            disabled={exportandoBarcode}
            startIcon={<BusyIcon busy={exportandoBarcode}><IconQr /></BusyIcon>}
          >
            QR
          </Button>
          <Button
            onClick={onPrintCatalog}
            disabled={imprimiendo}
            startIcon={<BusyIcon busy={imprimiendo}><IconPrint /></BusyIcon>}
          >
            Catálogo
          </Button>
        </ButtonGroup>

        {canExportTienda ? (
          <Button
            variant="outlined"
            size="small"
            onClick={onUpdateStore}
            disabled={actualizandoTienda}
            title="Genera inventory.json y upcoming.json y publica la tienda"
            startIcon={<BusyIcon busy={actualizandoTienda}><IconDownload /></BusyIcon>}
          >
            {actualizandoTienda ? "Publicando…" : "Tienda"}
          </Button>
        ) : null}

        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => void onClearAllPvp()}
          disabled={limpiandoPvp}
          startIcon={<BusyIcon busy={limpiandoPvp}><IconTrash /></BusyIcon>}
        >
          {limpiandoPvp ? "Limpiando…" : "Limpiar PVP"}
        </Button>
      </Stack>
    </Stack>
  );
}

type StockInventoryStatsProps = {
  precioInventario: MoneyTriple;
  ventasEsperadas: MoneyTriple;
  gananciaEsperada: MoneyTriple;
};

function Stat({
  label,
  cop,
  eur,
  usd,
  emphasize,
}: {
  label: string;
  cop: number;
  eur: number;
  usd: number;
  emphasize?: "gain" | "loss";
}) {
  const copColor =
    emphasize === "gain"
      ? "success.main"
      : emphasize === "loss"
        ? "error.main"
        : "text.primary";
  const prefix = cop > 0 && emphasize ? "+" : "";

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing="0.04em">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} color={copColor} noWrap>
        {prefix}COP {formatCOP(cop.toFixed(0))}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        EUR {eur.toFixed(2)} / USD {usd.toFixed(2)}
      </Typography>
    </Box>
  );
}

export function StockInventoryStats({
  precioInventario,
  ventasEsperadas,
  gananciaEsperada,
}: StockInventoryStatsProps) {
  const gainTone =
    gananciaEsperada.cop > 0 ? "gain" : gananciaEsperada.cop < 0 ? "loss" : undefined;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: 1.5,
        px: 1.5,
        py: 1,
        mb: 1,
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Stat
        label="Inventario"
        cop={precioInventario.cop}
        eur={precioInventario.eur}
        usd={precioInventario.usd}
      />
      <Stat
        label="Ventas esperadas"
        cop={ventasEsperadas.cop}
        eur={ventasEsperadas.eur}
        usd={ventasEsperadas.usd}
      />
      <Stat
        label="Ganancia"
        cop={gananciaEsperada.cop}
        eur={gananciaEsperada.eur}
        usd={gananciaEsperada.usd}
        emphasize={gainTone}
      />
    </Box>
  );
}
