import type { ReactNode } from "react";
import { Box } from "@mui/material";

/** Estilos base para tablas DataGrid en pantallas estrechas */
export const dataGridShellSx = {
  width: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  borderRadius: 2,
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
} as const;

export const dataGridTableSx = {
  border: 0,
  minWidth: { xs: 520, sm: 640 },
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: "grey.50",
    fontWeight: 600,
  },
  "& .MuiDataGrid-cell": {
    alignItems: "center",
  },
} as const;

type ResponsiveDataGridShellProps = {
  children: ReactNode;
  minWidth?: number | { xs?: number; sm?: number };
};

/** Envuelve un DataGrid para permitir scroll horizontal en móvil sin romper el layout */
export function ResponsiveDataGridShell({
  children,
  minWidth = { xs: 520, sm: 720 },
}: ResponsiveDataGridShellProps) {
  return (
    <Box sx={dataGridShellSx}>
      <Box sx={{ minWidth }}>{children}</Box>
    </Box>
  );
}
