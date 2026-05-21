import type { ReactNode } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

type PageContainerProps = {
  children: ReactNode;
  /** Ancho máximo del contenido; por defecto ocupa todo el ancho útil */
  maxWidth?: number | string | false;
  sx?: SxProps<Theme>;
};

/**
 * Contenedor de página: ancho fluido, centrado y sin padding duplicado
 * (el padding lo aplica SideLayout en el `<main>`).
 */
export function PageContainer({
  children,
  maxWidth = 1280,
  sx,
}: PageContainerProps) {
  return (
    <Box
      sx={{
        width: "100%",
        ...(maxWidth !== false && { maxWidth, mx: "auto" }),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
