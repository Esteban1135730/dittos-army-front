import type { SxProps, Theme } from "@mui/material";

export {
  clientesActionRowSx as propertyActionRowSx,
  clientesHighlightPanelSx as propertyHighlightPanelSx,
  clientesKpiCardSx as propertyKpiCardSx,
  clientesKpiGridSx as propertyKpiGridSx,
  clientesMutedLabelSx as propertyMutedLabelSx,
  clientesPageSx as propertyPageSx,
  clientesSectionPaperSx as propertySectionPaperSx,
  clientesStatValueSx as propertyStatValueSx,
  clientesToolbarSx as propertyToolbarSx,
} from "../../clientes/clientes-page-layout";

export const propertyCardsGridSx: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: {
    lg: "1fr",
    xl: "repeat(2, minmax(0, 1fr))",
    "@media (min-width: 2560px)": "repeat(3, minmax(0, 1fr))",
  },
  gap: 2,
};

export const propertyCardSx: SxProps<Theme> = (theme) => ({
  p: 2.5,
  borderRadius: 2.5,
  border: 1,
  borderColor: theme.palette.secondary.light,
  bgcolor: "background.paper",
  boxShadow: "none",
  height: "100%",
});
