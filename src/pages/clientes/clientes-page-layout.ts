import type { SxProps, Theme } from "@mui/material";
import { PANEL_DATAGRID_HEADER_HEIGHT } from "../../theme/panel-density";

/** Contenedor principal — laptop → 2K → 4K (sin breakpoints móvil). */
export const clientesPageSx: SxProps<Theme> = {
  width: "100%",
  maxWidth: { lg: 1360, xl: 1680, "@media (min-width: 2560px)": 2200 },
  mx: "auto",
  px: { lg: 0.5, xl: 2, "@media (min-width: 2560px)": 5 },
  py: { lg: 0.5, xl: 2, "@media (min-width: 2560px)": 4 },
};

export const clientesSectionPaperSx: SxProps<Theme> = {
  borderRadius: 2.5,
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
  overflow: "hidden",
};

export const clientesSectionHeaderSx: SxProps<Theme> = {
  px: 2,
  py: 1.25,
  borderBottom: 1,
  borderColor: "divider",
  bgcolor: "grey.50",
};

export const clientesSectionBodySx: SxProps<Theme> = {
  p: 2,
};

export const clientesKpiGridSx: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: {
    lg: "repeat(4, 1fr)",
    "@media (min-width: 2560px)": "repeat(4, 1fr)",
  },
  gap: 2,
};

export const clientesKpiCardSx: SxProps<Theme> = {
  p: 2,
  borderRadius: 2,
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
};

export const clientesToolbarSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  flexWrap: "wrap",
};

export const clientesDetailGridSx: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: {
    lg: "minmax(0, 1fr) 320px",
    xl: "minmax(0, 1fr) 360px",
    "@media (min-width: 2560px)": "minmax(0, 1fr) 400px",
  },
  gap: 3,
  alignItems: "start",
};

export const clientesActionRowSx: SxProps<Theme> = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 1,
  "& .MuiButton-root": {
    textTransform: "none",
    fontWeight: 600,
    borderRadius: 1.5,
    px: 2,
  },
};

export const clientesMutedLabelSx: SxProps<Theme> = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "text.secondary",
  lineHeight: 1.4,
};

export const clientesStatValueSx: SxProps<Theme> = {
  fontWeight: 700,
  lineHeight: 1.25,
  mt: 0.25,
  color: "text.primary",
};

export const clientesDataGridSx: SxProps<Theme> = (theme) => ({
  border: 0,
  cursor: "pointer",
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: theme.palette.ditto.surface.muted,
    borderBottom: 1,
    borderColor: "divider",
    minHeight: `${PANEL_DATAGRID_HEADER_HEIGHT}px !important`,
    maxHeight: `${PANEL_DATAGRID_HEADER_HEIGHT}px !important`,
  },
  "& .MuiDataGrid-columnHeaderTitle": {
    fontWeight: 700,
    fontSize: "0.8125rem",
    color: theme.palette.ditto.text.secondary,
  },
  "& .MuiDataGrid-cell": {
    borderColor: "divider",
    py: 1,
    display: "flex",
    alignItems: "center",
  },
  "& .row-pedido-alerta": { bgcolor: theme.palette.ditto.semantic.warningBg },
  "& .row-pedido-critico": { bgcolor: theme.palette.ditto.semantic.errorBg },
});

/** Grid de líneas de historial — más columnas en pantallas grandes. */
export const historialLineasGridSx: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: {
    lg: "1fr",
    xl: "repeat(2, minmax(0, 1fr))",
    "@media (min-width: 2560px)": "repeat(3, minmax(0, 1fr))",
  },
  gap: 1.5,
};

/** Bloque destacado (totales, entrega). */
export const clientesHighlightPanelSx: SxProps<Theme> = (theme) => ({
  p: 2.5,
  borderRadius: 2,
  bgcolor: theme.palette.ditto.surface.muted,
  border: 1,
  borderColor: theme.palette.ditto.border.default,
});

/** KPI con alerta visual. */
export const clientesKpiWarnSx: SxProps<Theme> = (theme) => ({
  bgcolor: theme.palette.ditto.semantic.errorBg,
  borderColor: theme.palette.ditto.semantic.errorBorder,
});

/** Borde lateral de entrega en tienda vs envío. */
export const entregaStoreAccentSx: SxProps<Theme> = (theme) => ({
  borderLeftWidth: 4,
  borderLeftColor: theme.palette.primary.main,
});

export const entregaShipAccentSx: SxProps<Theme> = (theme) => ({
  borderLeftWidth: 4,
  borderLeftColor: theme.palette.ditto.semantic.warning,
});
